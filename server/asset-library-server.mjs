#!/usr/bin/env node
import { createServer } from 'node:http';
import { createHash, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { copyFile, cp, mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const HOST = process.env.ASSET_LIBRARY_HOST ?? '127.0.0.1';
const PORT = Number(process.env.ASSET_LIBRARY_PORT ?? 3100);
const DATA_DIR = path.resolve(process.env.ASSET_LIBRARY_DATA_DIR ?? './data/asset-library');
const STATIC_DIR = process.env.ASSET_LIBRARY_STATIC_DIR
  ? path.resolve(process.env.ASSET_LIBRARY_STATIC_DIR)
  : null;
const MAX_BODY_BYTES = Number(process.env.ASSET_LIBRARY_MAX_BODY_MB ?? 512) * 1024 * 1024;

const MODELS_DIR = path.join(DATA_DIR, 'models');
const DELETED_ASSETS_DIR = path.join(DATA_DIR, 'deleted-assets');
const HILL_REGEN_JOBS_DIR = path.join(DATA_DIR, 'hill-regen-jobs');
const HILL_CONJURE_JOBS_DIR = path.join(DATA_DIR, 'hill-conjure-jobs');
const HILL_EXPORT_JOBS_DIR = path.join(DATA_DIR, 'hill-export-jobs');
const HILL_ROOT = process.env.HILL_ROOT ?? '/home/ms/hill';
const HILL_CONJURE_SCRIPT = process.env.HILL_CONJURE_SCRIPT ?? path.join(HILL_ROOT, 'scripts/conjure_asset.py');
const HILL_ENRICH_EXPORT_SCRIPT = process.env.HILL_ENRICH_EXPORT_SCRIPT ?? path.join(HILL_ROOT, 'scripts/enrich_export_job.py');
const HILL_MARKETPLACE_PACKAGE_SCRIPT = process.env.HILL_MARKETPLACE_PACKAGE_SCRIPT ?? path.join(HILL_ROOT, 'scripts/package_vrmviewer_asset.py');
const HILL_PROMOTE_ASSET_SCRIPT = process.env.HILL_PROMOTE_ASSET_SCRIPT ?? path.join(HILL_ROOT, 'scripts/promote_asset_queue.py');
const HILL_LOD_SCRIPT = process.env.HILL_LOD_SCRIPT ?? '/tank/comfy/trellis2-bake/optimize_glb_lod.sh';
const HILL_ASSET_LIBRARY_INDEX_DIR = process.env.HILL_ASSET_LIBRARY_INDEX_DIR ?? '/tank/asset-library/index';
const HILL_PROMOTION_QUEUE_CSV = path.join(HILL_ASSET_LIBRARY_INDEX_DIR, 'promotion_queue.csv');
const HILL_MARKETPLACE_STATUS_JSON = path.join(HILL_ASSET_LIBRARY_INDEX_DIR, 'marketplace_status.json');
const HILL_CATALOG_ROOT = process.env.HILL_CATALOG_ROOT ?? '/tank/3d-catalog';
const FILE_BACKED_ASSET_ROOTS = (process.env.ASSET_LIBRARY_FILE_ROOTS ?? '/tank/asset-library/assets')
  .split(':')
  .map((root) => path.resolve(root))
  .filter(Boolean);
const SAFE_HILL_FILE_ROOTS = [
  '/tank/asset-library/assets',
  '/tank/3d/conjured_assets',
  '/tank/3d/game_asset_store',
  '/tank/3d/marketplace_store',
  '/tank/3d-catalog/assetforge-props',
  '/tank/3d-catalog/preview-glbs',
  '/tank/comfy/workspace/output',
].map((root) => path.resolve(root));
const DELETABLE_ASSET_ROOTS = [
  '/tank/asset-library/assets',
  '/tank/3d/conjured_assets',
  '/tank/3d/game_asset_store',
  '/tank/3d/marketplace_store',
  '/tank/3d-catalog/assetforge-props',
  '/tank/3d-catalog/preview-glbs',
].map((root) => path.resolve(root));
const ALLOWED_FORMATS = new Set(['vrm', 'gltf', 'glb', 'fbx']);
const FILE_BACKED_FORMATS = new Set(['.vrm', '.gltf', '.glb', '.fbx']);
const FILE_BACKED_SKIP_DIRS = new Set([
  '.git',
  '__pycache__',
  '_trash',
  'deleted-assets',
  'legacy-root-clutter',
  'node_modules',
  'packages',
  'raw',
]);
const LOCAL_IMAGE_CONTENT_TYPES = new Map([
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.glb', 'model/gltf-binary'],
  ['.gltf', 'model/gltf+json'],
]);
const STATIC_CONTENT_TYPES = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.wasm', 'application/wasm'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.svg', 'image/svg+xml'],
  ['.ico', 'image/x-icon'],
  ['.txt', 'text/plain; charset=utf-8'],
]);
const BUILDING_PROMPT_TERMS = [
  'building',
  'cottage',
  'house',
  'cabin',
  'hut',
  'chalet',
  'tower',
  'shop',
  'inn',
  'temple',
];
let hillGpuQueue = Promise.resolve();
const MODEL_RECORDS_CACHE_TTL_MS = Number(process.env.ASSET_LIBRARY_MODELS_CACHE_MS ?? 30000);
let modelRecordsCache = null;
const catalogMetadataCache = new Map();
let marketplaceStatusCache = null;

function invalidateModelRecordsCache() {
  modelRecordsCache = null;
}

function json(res, statusCode, value) {
  const body = JSON.stringify(value);
  res.writeHead(statusCode, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,HEAD,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function error(res, statusCode, message, details) {
  json(res, statusCode, { success: false, error: { message, details } });
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function readBody(req) {
  const chunks = [];
  let total = 0;

  for await (const chunk of req) {
    total += chunk.length;
    if (total > MAX_BODY_BYTES) {
      throw new Error(`Request body exceeds ${MAX_BODY_BYTES} bytes`);
    }
    chunks.push(chunk);
  }

  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function modelDir(uuid) {
  return path.join(MODELS_DIR, uuid);
}

function modelMetadataPath(uuid) {
  return path.join(modelDir(uuid), 'metadata.json');
}

function modelBinaryPath(uuid, format) {
  return path.join(modelDir(uuid), `model.${format}`);
}

function modelThumbnailPath(uuid, extension) {
  return path.join(modelDir(uuid), `thumbnail.${extension}`);
}

function fileBackedUuid(filePath) {
  return `fs_${createHash('sha1').update(path.resolve(filePath)).digest('hex').slice(0, 24)}`;
}

function isPathWithin(filePath, root) {
  const relative = path.relative(root, filePath);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function resolvePathInsideRoots(filePath, roots) {
  if (!filePath || typeof filePath !== 'string') return null;
  const resolved = path.resolve(filePath);
  return roots.some((root) => isPathWithin(resolved, root)) ? resolved : null;
}

function parseThumbnailDataUrl(value) {
  if (typeof value !== 'string') return null;
  const match = /^data:image\/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/=\s]+)$/.exec(value);
  if (!match) return null;
  const format = match[1] === 'jpg' ? 'jpeg' : match[1];
  return {
    format,
    extension: format === 'jpeg' ? 'jpg' : format,
    data: match[2].replace(/\s/g, ''),
  };
}

function looksLikeBuildingPrompt(prompt) {
  const text = String(prompt ?? '').toLowerCase();
  return BUILDING_PROMPT_TERMS.some((term) => text.includes(term));
}

function slugify(value) {
  const slug = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return slug || 'asset';
}

function assetKeywordsFromText(...values) {
  const stopWords = new Set([
    'a', 'an', 'and', 'asset', 'complete', 'for', 'from', 'game', 'generated',
    'in', 'lod', 'model', 'of', 'one', 'prop', 'the', 'to', 'with',
  ]);
  const words = values
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/[^a-z0-9\\s]+/g, ' ')
    .split(/\\s+/)
    .filter((word) => word.length > 2 && !stopWords.has(word));
  return [...new Set(words)].slice(0, 16);
}

function assetTagsForRecord({ name, description, category, prompt, extra = [] }) {
  const text = `${name ?? ''} ${description ?? ''} ${prompt ?? ''}`.toLowerCase();
  const tags = [];
  if (category) tags.push(String(category).replace(/_/g, ' '));
  if (/\\b(cabin|cottage|house|hut|chalet|building|tower|shop|inn|temple)\\b/.test(text)) tags.push('building');
  if (/\\bcabin\\b/.test(text)) tags.push('cabin');
  if (/\\bcottage\\b/.test(text)) tags.push('cottage');
  if (/\\blog\\b|\\btimber\\b|\\bwood\\b|\\bwooden\\b/.test(text)) tags.push('wood');
  if (/\\balpine\\b|\\bmountain\\b|\\bchalet\\b/.test(text)) tags.push('mountain');
  if (/\\btree\\b|\\boak\\b|\\bmaple\\b|\\bpine\\b|\\bcherry\\b|\\bbirch\\b/.test(text)) tags.push('tree');
  tags.push(...assetKeywordsFromText(name, prompt, description), ...extra);
  return [...new Set(tags.filter(Boolean))].slice(0, 18);
}

function hillRegenJobPath(id) {
  return path.join(HILL_REGEN_JOBS_DIR, `${id}.json`);
}

function hillConjureJobPath(id) {
  return path.join(HILL_CONJURE_JOBS_DIR, `${id}.json`);
}

function enqueueHillGpuJob(label, task) {
  const run = hillGpuQueue
    .catch(() => undefined)
    .then(async () => {
      console.log(`[asset-library] hill gpu job started: ${label}`);
      try {
        await task();
      } finally {
        console.log(`[asset-library] hill gpu job finished: ${label}`);
      }
    });
  hillGpuQueue = run.catch((err) => {
    console.error(`[asset-library] hill gpu job failed outside handler: ${label}`, err);
  });
  return run;
}

function runHillScript(args, logPath, errorLabel) {
  return new Promise((resolve, reject) => {
    const child = spawn('python3', args, {
      cwd: HILL_ROOT,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', (err) => {
      reject(err);
    });
    child.on('close', async (code) => {
      try {
        await writeFile(logPath, `${stdout}\n${stderr}`);
        if (code !== 0) {
          reject(new Error(`${errorLabel} exited ${code}: ${stderr.trim() || stdout.trim()}`));
          return;
        }
        resolve({ stdout, stderr });
      } catch (err) {
        reject(err);
      }
    });
  });
}

function toIsoRecord(record) {
  return {
    ...record,
    createdAt: new Date(record.createdAt).toISOString(),
    updatedAt: new Date(record.updatedAt).toISOString(),
  };
}

function stripData(record) {
  const { data: _data, dataBase64: _dataBase64, ...summary } = record;
  void _data;
  void _dataBase64;
  return summary;
}

function stripListPayload(record) {
  const summary = stripData(record);
  if (typeof summary.thumbnail === 'string' && summary.thumbnail.startsWith('data:image/')) {
    return {
      ...summary,
      thumbnail: `/api/models/${encodeURIComponent(summary.uuid)}/thumbnail`,
      thumbnailFormat: summary.thumbnailFormat ?? summary.thumbnail.match(/^data:image\/([^;]+)/)?.[1] ?? undefined,
    };
  }
  return summary;
}

async function fileExists(filePath) {
  try {
    const info = await stat(filePath);
    return info.isFile();
  } catch {
    return false;
  }
}

async function sendStaticFile(req, res, requestPath) {
  if (!STATIC_DIR) return false;
  if (req.method !== 'GET' && req.method !== 'HEAD') return false;

  const decodedPath = (() => {
    try {
      return decodeURIComponent(requestPath);
    } catch {
      return '/';
    }
  })();
  const normalizedPath = decodedPath === '/' ? '/index.html' : decodedPath;
  const candidate = path.resolve(STATIC_DIR, `.${normalizedPath}`);
  const staticPath = isPathWithin(candidate, STATIC_DIR) && await fileExists(candidate)
    ? candidate
    : path.join(STATIC_DIR, 'index.html');

  if (!await fileExists(staticPath)) return false;

  const info = await stat(staticPath);
  const extension = path.extname(staticPath).toLowerCase();
  const isAsset = staticPath !== path.join(STATIC_DIR, 'index.html');
  res.writeHead(200, {
    'Content-Type': STATIC_CONTENT_TYPES.get(extension) ?? 'application/octet-stream',
    'Content-Length': info.size,
    'Cache-Control': isAsset ? 'public, max-age=31536000, immutable' : 'no-cache',
  });
  if (req.method === 'HEAD') return true;
  res.end(await readFile(staticPath));
  return true;
}

async function* walkAssetFiles(root) {
  let entries = [];
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (entry.name.startsWith('.') || FILE_BACKED_SKIP_DIRS.has(entry.name)) continue;
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      yield* walkAssetFiles(entryPath);
    } else if (entry.isFile() && FILE_BACKED_FORMATS.has(path.extname(entry.name).toLowerCase())) {
      yield entryPath;
    }
  }
}

function titleFromSlug(value) {
  return String(value ?? '')
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase()) || 'Asset';
}

function inferAssetRoot(filePath) {
  const resolved = path.resolve(filePath);
  for (const root of FILE_BACKED_ASSET_ROOTS) {
    if (!isPathWithin(resolved, root)) continue;
    const parts = path.relative(root, resolved).split(path.sep).filter(Boolean);
    if (root.endsWith(path.join('asset-library', 'assets'))) {
      if (parts[0] === 'generated' && parts.length >= 3) return path.join(root, parts[0], parts[1], parts[2]);
      if (parts.length >= 2) return path.join(root, parts[0], parts[1]);
    }
    if (parts.length >= 1) return path.join(root, parts[0]);
  }
  return path.dirname(filePath);
}

function inferPackSlugFromPath(filePath) {
  return path.basename(inferAssetRoot(filePath));
}

async function readNearestCatalogMetadata(packSlug) {
  if (catalogMetadataCache.has(packSlug)) return catalogMetadataCache.get(packSlug);
  const candidate = path.join(HILL_CATALOG_ROOT, 'assetforge-props', packSlug, 'metadata.json');
  try {
    const metadata = await readJson(candidate);
    catalogMetadataCache.set(packSlug, metadata);
    return metadata;
  } catch {
    catalogMetadataCache.set(packSlug, null);
    return null;
  }
}

function lodTierFromName(filePath) {
  const match = path.basename(filePath, path.extname(filePath)).match(/(?:^|[_-])(default|lod[0-9])(?:$|[_-])/i);
  return match ? match[1].toLowerCase() : 'default';
}

function baseAssetName(filePath) {
  return path.basename(filePath, path.extname(filePath))
    .replace(/(?:^|[_-])(default|lod[0-9])(?:$|[_-]).*$/i, '')
    .replace(/[_-]+$/g, '') || path.basename(filePath, path.extname(filePath));
}

function rawMeshForOptimizedDefault(filePath) {
  const resolved = path.resolve(filePath);
  const parent = path.basename(path.dirname(resolved));
  const basename = path.basename(resolved, path.extname(resolved));
  if (parent !== '_lod' || !/(?:^|[_-])default$/i.test(basename)) return null;

  const rawStem = basename.replace(/(?:^|[_-])default$/i, '');
  if (!rawStem) return null;
  return path.join(path.dirname(path.dirname(resolved)), `${rawStem}${path.extname(resolved)}`);
}

async function shouldSkipFileBackedAsset(filePath) {
  const rawMesh = rawMeshForOptimizedDefault(filePath);
  return rawMesh ? fileExists(rawMesh) : false;
}

function isLodSidecarFile(filePath) {
  return path.basename(path.dirname(path.resolve(filePath))).startsWith('_lod');
}

function pickHeroImage(meta, propName) {
  const hero = meta?.hero_renders ?? meta?.heroMedia ?? {};
  const perProp = hero.per_prop ?? hero.perProp ?? {};
  const prop = (meta?.props ?? []).find((item) => item?.name === propName || item?.name === baseAssetName(propName ?? ''));
  return prop?.ref_image ?? perProp?.[propName]?.primary ?? hero.primary ?? hero.fab_cover ?? hero.fabCover;
}

async function buildFileBackedRecord(filePath, overlayBySource) {
  const sourcePath = path.resolve(filePath);
  const overlay = overlayBySource.get(sourcePath);
  const info = await stat(sourcePath);
  const packSlug = overlay?.packSlug ?? inferPackSlugFromPath(sourcePath);
  const catalogMeta = await readNearestCatalogMetadata(packSlug);
  const packName = overlay?.packName ?? catalogMeta?.title ?? titleFromSlug(packSlug);
  const propName = overlay?.metadata?.prop?.name ?? baseAssetName(sourcePath);
  const tier = overlay?.lodTier ?? lodTierFromName(sourcePath);
  const marketplace = overlay?.exports?.store?.platforms ?? overlay?.metadata?.marketplace ?? await marketplaceStatusForSlug(packSlug);
  const thumb = overlay?.thumbnail ?? pickHeroImage(catalogMeta, propName);

  return {
    ...(overlay ?? {}),
    uuid: overlay?.uuid ?? fileBackedUuid(sourcePath),
    name: overlay?.name ?? `${packName} - ${titleFromSlug(propName)} (${tier.toUpperCase()})`,
    displayName: overlay?.displayName ?? overlay?.name ?? `${packName} - ${titleFromSlug(propName)} (${tier.toUpperCase()})`,
    description: overlay?.description ?? catalogMeta?.description ?? '',
    category: overlay?.category ?? catalogMeta?.category ?? 'asset',
    tags: overlay?.tags ?? catalogMeta?.keywords ?? [],
    format: path.extname(sourcePath).slice(1).toLowerCase(),
    version: overlay?.version ?? '1.0',
    author: overlay?.author ?? 'Hill / DaVinci Dreams',
    license: overlay?.license ?? (Object.keys(marketplace).length ? 'commercial_marketplace' : 'platform_public_license'),
    size: info.size,
    isHumanoid: overlay?.isHumanoid ?? false,
    searchTokens: overlay?.searchTokens ?? [packName, propName, catalogMeta?.description, ...(catalogMeta?.keywords ?? [])]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .split(/\s+/),
    sourcePath,
    assetGroupId: overlay?.assetGroupId ?? `${packSlug}:${propName}`,
    lodTier: tier,
    packSlug,
    packName,
    qualityTier: overlay?.qualityTier ?? 'game_ready',
    reviewStatus: overlay?.reviewStatus ?? 'pending',
    priceUsd: overlay?.priceUsd ?? catalogMeta?.price_usd,
    thumbnail: thumb,
    exports: {
      ...(overlay?.exports ?? {}),
      store: {
        ...(overlay?.exports?.store ?? {}),
        status: Object.keys(marketplace).length ? 'draft' : 'unlisted',
        platforms: marketplace,
      },
    },
    metadata: {
      ...(overlay?.metadata ?? {}),
      title: overlay?.metadata?.title ?? catalogMeta?.title ?? packName,
      description: overlay?.metadata?.description ?? catalogMeta?.description,
      keywords: overlay?.metadata?.keywords ?? catalogMeta?.keywords ?? [],
      packSlug,
      packName,
      sourceCatalog: overlay?.metadata?.sourceCatalog ?? path.join(HILL_CATALOG_ROOT, 'assetforge-props', packSlug, 'metadata.json'),
      marketplace,
      prop: overlay?.metadata?.prop ?? { name: propName, ref_image: pickHeroImage(catalogMeta, propName) },
      isFileBacked: true,
    },
    createdAt: overlay?.createdAt ?? info.birthtime.toISOString(),
    updatedAt: overlay?.updatedAt ?? info.mtime.toISOString(),
  };
}

function parseCsvLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];
    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current);
  return values;
}

async function readPromotionQueue() {
  let csvText = '';
  try {
    csvText = await readFile(HILL_PROMOTION_QUEUE_CSV, 'utf8');
  } catch (err) {
    if (err?.code === 'ENOENT') return [];
    throw err;
  }
  const lines = csvText.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]);
  const rows = [];
  for (const line of lines.slice(1)) {
    const values = parseCsvLine(line);
    const row = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));
    const slug = row.slug;
    const catalog = await catalogStatusForSlug(slug);
    rows.push({
      slug,
      packRoot: row.pack_root,
      sourceRole: row.source_role,
      promotionStatus: row.promotion_status,
      categoryHint: row.category_hint,
      fileCount: Number(row.file_count || 0),
      totalSizeBytes: Number(row.total_size_bytes || 0),
      lodTiers: row.lod_tiers ? row.lod_tiers.split(',').filter(Boolean) : [],
      catalog,
    });
  }
  return rows;
}

function normalizeMarketplacePlatform(platform) {
  if (!platform || typeof platform !== 'object') return undefined;
  return {
    platform: platform.platform,
    status: platform.status,
    remoteStatus: platform.remote_status ?? platform.remoteStatus,
    url: platform.url,
    editUrl: platform.edit_url ?? platform.editUrl,
    productId: platform.product_id ?? platform.productId,
    uid: platform.uid,
    count: typeof platform.count === 'number' ? platform.count : platform.count ? Number(platform.count) : undefined,
    uploadedAt: platform.uploaded_at ?? platform.uploadedAt,
    source: platform.source,
    lastError: platform.last_error ?? platform.lastError,
  };
}

async function marketplaceStatusForSlug(slug) {
  if (!slug) return {};
  try {
    if (!marketplaceStatusCache) {
      const marketplaceIndex = await readJson(HILL_MARKETPLACE_STATUS_JSON);
      marketplaceStatusCache = new Map(
        Array.isArray(marketplaceIndex?.records)
          ? marketplaceIndex.records.map((item) => [item?.slug, item]).filter(([key]) => Boolean(key))
          : [],
      );
    }
    const record = marketplaceStatusCache.get(slug);
    if (!record?.platforms || typeof record.platforms !== 'object') return {};
    return Object.fromEntries(
      Object.entries(record.platforms)
        .map(([platform, value]) => [platform, normalizeMarketplacePlatform(value)])
        .filter(([, value]) => value),
    );
  } catch (err) {
    if (err?.code !== 'ENOENT') {
      console.warn(`[asset-library] unable to read marketplace status for ${slug}:`, err);
    }
    return {};
  }
}

async function catalogStatusForSlug(slug) {
  if (!slug) return { cataloged: false };
  const marketplace = await marketplaceStatusForSlug(slug);
  const categories = ['assetforge-props', 'textures', 'splat-scenes', 'bundles'];
  for (const category of categories) {
    const metadataPath = path.join(HILL_CATALOG_ROOT, category, slug, 'metadata.json');
    try {
      const metadata = await readJson(metadataPath);
      const marketplaceDir = path.join(HILL_CATALOG_ROOT, category, slug, 'marketplace');
      const gumroadManual = path.join(HILL_CATALOG_ROOT, category, slug, 'marketplace', 'gumroad', 'manual_completion.md');
      const fabDir = path.join(HILL_CATALOG_ROOT, category, slug, 'marketplace', 'fab');
      const gumroad = await exists(gumroadManual) ? 'manual_upload_ready' : undefined;
      const fab = await exists(fabDir) ? 'manual_upload_ready' : undefined;
      return {
        cataloged: true,
        category,
        metadataPath,
        title: metadata.title,
        priceUsd: metadata.price_usd,
        store: {
          gumroad,
          fab,
        },
        marketplace,
      };
    } catch (err) {
      if (err?.code !== 'ENOENT') {
        console.warn(`[asset-library] unable to read catalog metadata for ${slug}:`, err);
      }
    }
  }
  return { cataloged: false, marketplace };
}

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

function runHillPromoteAsset(slugs, { importVrm }) {
  return new Promise((resolve, reject) => {
    const args = [
      HILL_PROMOTE_ASSET_SCRIPT,
      '--slugs',
      slugs.join(','),
    ];
    if (importVrm) args.push('--import-vrm');
    const child = spawn('python3', args, {
      cwd: HILL_ROOT,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`asset promotion exited ${code}: ${stderr.trim() || stdout.trim()}`));
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

async function listStoredModelRecords() {
  await mkdir(MODELS_DIR, { recursive: true });
  const entries = await readdir(MODELS_DIR, { withFileTypes: true });
  const records = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    try {
      const record = await readJson(modelMetadataPath(entry.name));
      records.push(record);
    } catch (err) {
      console.warn(`[asset-library] skipping unreadable model ${entry.name}:`, err);
    }
  }

  records.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return records;
}

async function listFileBackedModelRecords(storedRecords = []) {
  const overlayBySource = new Map(
    storedRecords
      .filter((record) => record?.sourcePath)
      .map((record) => [path.resolve(record.sourcePath), record]),
  );
  const records = [];
  const seenSources = new Set();

  for (const root of FILE_BACKED_ASSET_ROOTS) {
    for await (const filePath of walkAssetFiles(root)) {
      const resolved = path.resolve(filePath);
      if (await shouldSkipFileBackedAsset(resolved)) continue;
      if (seenSources.has(resolved)) continue;
      seenSources.add(resolved);
      try {
        records.push(await buildFileBackedRecord(resolved, overlayBySource));
      } catch (err) {
        console.warn(`[asset-library] skipping unreadable file-backed asset ${resolved}:`, err);
      }
    }
  }

  return records;
}

async function listFileBackedAssetPathInfos() {
  const infos = [];
  const seenSources = new Set();
  for (const root of FILE_BACKED_ASSET_ROOTS) {
    for await (const filePath of walkAssetFiles(root)) {
      const sourcePath = path.resolve(filePath);
      if (isLodSidecarFile(sourcePath)) continue;
      if (await shouldSkipFileBackedAsset(sourcePath)) continue;
      if (seenSources.has(sourcePath)) continue;
      seenSources.add(sourcePath);
      try {
        const info = await stat(sourcePath);
        const packSlug = inferPackSlugFromPath(sourcePath);
        const category = path.relative(FILE_BACKED_ASSET_ROOTS[0], sourcePath).split(path.sep).filter(Boolean)[0] ?? 'asset';
        const propName = baseAssetName(sourcePath);
        infos.push({
          sourcePath,
          packSlug,
          category,
          propName,
          name: `${titleFromSlug(packSlug)} - ${titleFromSlug(propName)} (${lodTierFromName(sourcePath).toUpperCase()})`,
          format: path.extname(sourcePath).slice(1).toLowerCase(),
          size: info.size,
          createdAt: info.birthtime.toISOString(),
          updatedAt: info.mtime.toISOString(),
        });
      } catch {
        // Ignore files that disappeared while scanning.
      }
    }
  }
  return infos;
}

function sortPathInfos(infos, sort) {
  const sorted = [...infos];
  switch (sort) {
    case 'oldest':
      sorted.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      break;
    case 'name':
      sorted.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case 'size':
      sorted.sort((a, b) => b.size - a.size);
      break;
    case 'recent':
    default:
      sorted.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      break;
  }
  return sorted;
}

async function queryPagedFileBackedModelRecords(searchParams) {
  const search = String(searchParams.get('search') ?? '').trim().toLowerCase();
  const format = String(searchParams.get('format') ?? '').trim();
  const category = String(searchParams.get('category') ?? '').trim();
  const packSlug = String(searchParams.get('packSlug') ?? '').trim();
  const assetKind = String(searchParams.get('assetKind') ?? 'all');
  const sort = String(searchParams.get('sort') ?? 'recent');
  const offset = Math.max(0, Number(searchParams.get('offset') ?? 0) || 0);
  const limit = Math.max(1, Math.min(250, Number(searchParams.get('limit') ?? 96) || 96));

  let infos = await listFileBackedAssetPathInfos();
  if (search) {
    infos = infos.filter((info) => [info.name, info.packSlug, info.propName, info.sourcePath].join(' ').toLowerCase().includes(search));
  }
  if (format) infos = infos.filter((info) => info.format === format);
  if (category) infos = infos.filter((info) => info.category === category);
  if (packSlug) infos = infos.filter((info) => info.packSlug === packSlug);
  if (assetKind !== 'all') {
    infos = infos.filter((info) => assetKind === 'textures' ? info.packSlug.includes('_pbr_') || info.category === 'textures' : !(info.packSlug.includes('_pbr_') || info.category === 'textures'));
  }

  const sorted = sortPathInfos(infos, sort);
  const pageInfos = sorted.slice(offset, offset + limit);
  const storedRecords = await listStoredModelRecords();
  const overlayBySource = new Map(
    storedRecords
      .filter((record) => record?.sourcePath)
      .map((record) => [path.resolve(record.sourcePath), record]),
  );
  const records = [];
  for (const info of pageInfos) {
    records.push(await buildFileBackedRecord(info.sourcePath, overlayBySource));
  }
  return {
    records,
    meta: {
      total: sorted.length,
      offset,
      limit,
      hasMore: offset + limit < sorted.length,
    },
  };
}

async function listModelRecords() {
  const now = Date.now();
  if (modelRecordsCache && modelRecordsCache.expiresAt > now) {
    return modelRecordsCache.records;
  }
  const storedRecords = await listStoredModelRecords();
  const fileBackedRecords = await listFileBackedModelRecords(storedRecords);
  const records = fileBackedRecords;
  records.sort((a, b) => new Date(b.updatedAt ?? b.createdAt).getTime() - new Date(a.updatedAt ?? a.createdAt).getTime());
  modelRecordsCache = {
    expiresAt: now + MODEL_RECORDS_CACHE_TTL_MS,
    records,
  };
  return records;
}

function listingStatusForRecord(record) {
  const platforms = record?.exports?.store?.platforms ?? record?.metadata?.marketplace ?? {};
  const values = Object.values(platforms ?? {});
  if (values.length === 0) return 'unlisted';
  if (values.some((status) => status?.remoteStatus === 'FAILED' || status?.remote_status === 'FAILED' || status?.status === 'failed')) return 'failed';
  if (values.some((status) => status?.status === 'draft' || status?.remoteStatus === 'draft' || status?.remote_status === 'draft')) return 'draft';
  if (values.some((status) => Boolean(status?.url || status?.editUrl || status?.edit_url || status?.productId || status?.product_id || status?.uid))) return 'live';
  return 'unlisted';
}

function assetKindForRecord(record) {
  const category = String(record?.category ?? record?.metadata?.category ?? '').toLowerCase();
  if (category === 'texture_pack' || category === 'textures' || record?.format === 'texture' || String(record?.packSlug ?? '').includes('_pbr_')) {
    return 'texture';
  }
  return 'model';
}

function sortRecords(records, sort) {
  const sorted = [...records];
  switch (sort) {
    case 'oldest':
      sorted.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      break;
    case 'name':
      sorted.sort((a, b) => String(a.name ?? '').localeCompare(String(b.name ?? '')));
      break;
    case 'size':
      sorted.sort((a, b) => Number(b.size ?? 0) - Number(a.size ?? 0));
      break;
    case 'listed':
      sorted.sort((a, b) => Number(listingStatusForRecord(b) === 'live') - Number(listingStatusForRecord(a) === 'live') ||
        new Date(b.updatedAt ?? b.createdAt).getTime() - new Date(a.updatedAt ?? a.createdAt).getTime());
      break;
    case 'unlisted':
      sorted.sort((a, b) => Number(listingStatusForRecord(b) === 'unlisted') - Number(listingStatusForRecord(a) === 'unlisted') ||
        new Date(b.updatedAt ?? b.createdAt).getTime() - new Date(a.updatedAt ?? a.createdAt).getTime());
      break;
    case 'recent':
    default:
      sorted.sort((a, b) => new Date(b.updatedAt ?? b.createdAt).getTime() - new Date(a.updatedAt ?? a.createdAt).getTime());
      break;
  }
  return sorted;
}

function queryModelRecords(records, searchParams) {
  const search = String(searchParams.get('search') ?? '').trim().toLowerCase();
  const format = String(searchParams.get('format') ?? '').trim();
  const category = String(searchParams.get('category') ?? '').trim();
  const packSlug = String(searchParams.get('packSlug') ?? '').trim();
  const assetKind = String(searchParams.get('assetKind') ?? 'all');
  const listing = String(searchParams.get('listing') ?? 'all');
  const sort = String(searchParams.get('sort') ?? 'recent');
  const offset = Math.max(0, Number(searchParams.get('offset') ?? 0) || 0);
  const hasLimit = searchParams.has('limit');
  const rawLimit = Number(searchParams.get('limit') ?? records.length) || records.length;
  const limit = hasLimit ? Math.max(1, Math.min(250, rawLimit)) : records.length;

  let filtered = records;
  if (search) {
    filtered = filtered.filter((record) => {
      const haystack = [
        record.name,
        record.displayName,
        record.description,
        record.packName,
        record.packSlug,
        ...(record.tags ?? []),
        ...(record.metadata?.keywords ?? []),
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(search);
    });
  }
  if (format) filtered = filtered.filter((record) => record.format === format);
  if (category) filtered = filtered.filter((record) => record.category === category);
  if (packSlug) filtered = filtered.filter((record) => record.packSlug === packSlug);
  if (assetKind !== 'all') {
    filtered = filtered.filter((record) => assetKind === 'textures' ? assetKindForRecord(record) === 'texture' : assetKindForRecord(record) !== 'texture');
  }
  if (listing !== 'all') {
    filtered = filtered.filter((record) => listingStatusForRecord(record) === listing);
  }

  const sorted = sortRecords(filtered, sort);
  const page = sorted.slice(offset, offset + limit);
  return {
    records: page,
    meta: {
      total: sorted.length,
      offset,
      limit,
      hasMore: offset + limit < sorted.length,
    },
  };
}

async function listHillRegenJobs() {
  await mkdir(HILL_REGEN_JOBS_DIR, { recursive: true });
  const entries = await readdir(HILL_REGEN_JOBS_DIR, { withFileTypes: true });
  const jobs = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
    try {
      jobs.push(await readJson(path.join(HILL_REGEN_JOBS_DIR, entry.name)));
    } catch (err) {
      console.warn(`[asset-library] skipping unreadable Hill regen job ${entry.name}:`, err);
    }
  }

  jobs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return jobs;
}

async function listHillConjureJobs() {
  await mkdir(HILL_CONJURE_JOBS_DIR, { recursive: true });
  const entries = await readdir(HILL_CONJURE_JOBS_DIR, { withFileTypes: true });
  const jobs = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
    try {
      jobs.push(await readJson(path.join(HILL_CONJURE_JOBS_DIR, entry.name)));
    } catch (err) {
      console.warn(`[asset-library] skipping unreadable Hill conjure job ${entry.name}:`, err);
    }
  }

  jobs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return jobs;
}

async function listHillExportJobs() {
  await mkdir(HILL_EXPORT_JOBS_DIR, { recursive: true });
  const entries = await readdir(HILL_EXPORT_JOBS_DIR, { withFileTypes: true });
  const jobs = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
    try {
      jobs.push(await readJson(path.join(HILL_EXPORT_JOBS_DIR, entry.name)));
    } catch (err) {
      console.warn(`[asset-library] skipping unreadable Hill export job ${entry.name}:`, err);
    }
  }

  jobs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return jobs;
}

function hillExportJobPath(id) {
  return path.join(HILL_EXPORT_JOBS_DIR, `${id}.json`);
}

async function findBySha256(sha256) {
  if (!sha256) return null;
  const records = await listStoredModelRecords();
  return records.find((record) => record.sha256 === sha256) ?? null;
}

async function findBySourcePath(sourcePath) {
  if (!sourcePath) return null;
  const records = await listModelRecords();
  const resolved = path.resolve(sourcePath);
  return records.find((record) => record.sourcePath && path.resolve(record.sourcePath) === resolved) ?? null;
}

async function getModelRecord(uuid) {
  if (typeof uuid === 'string' && uuid.startsWith('fs_')) {
    const records = await listModelRecords();
    return records.find((record) => record.uuid === uuid) ?? null;
  }
  try {
    return await readJson(modelMetadataPath(uuid));
  } catch {
    return null;
  }
}

function buildModelRecord(payload, existing) {
  const now = new Date().toISOString();
  const uuid = existing?.uuid ?? payload.uuid ?? randomUUID();
  const format = payload.format;

  if (!ALLOWED_FORMATS.has(format)) {
    throw new Error(`Unsupported model format: ${format}`);
  }

  return {
    ...existing,
    ...payload,
    uuid,
    id: undefined,
    format,
    tags: Array.isArray(payload.tags) ? payload.tags : [],
    createdAt: existing?.createdAt ?? payload.createdAt ?? now,
    updatedAt: now,
    size: payload.size ?? existing?.size ?? 0,
    data: undefined,
    dataBase64: undefined,
  };
}

async function saveModel(payload, { skipDedup = false } = {}) {
  if (!payload?.dataBase64 || typeof payload.dataBase64 !== 'string') {
    throw new Error('dataBase64 is required');
  }

  if (!skipDedup && payload.sha256) {
    const existing = await findBySha256(payload.sha256);
    if (existing) return { record: existing, wasDeduped: true };
  }

  const record = buildModelRecord(payload);
  const buffer = Buffer.from(payload.dataBase64, 'base64');
  record.size = buffer.byteLength;

  await mkdir(modelDir(record.uuid), { recursive: true });
  await writeFile(modelBinaryPath(record.uuid, record.format), buffer);
  await persistEmbeddedThumbnail(record);
  await writeJson(modelMetadataPath(record.uuid), record);
  invalidateModelRecordsCache();

  return { record, wasDeduped: false };
}

async function saveModelFromFile(filePath, payload, { skipDedup = false } = {}) {
  const buffer = await readFile(filePath);
  const sha256 = createHash('sha256').update(buffer).digest('hex');
  if (!skipDedup) {
    const existingByPath = await findBySourcePath(filePath);
    if (existingByPath) return { record: existingByPath, wasDeduped: true };
    const existingByHash = await findBySha256(sha256);
    if (existingByHash) return { record: existingByHash, wasDeduped: true };
  }

  const record = buildModelRecord({
    ...payload,
    format: payload.format ?? 'glb',
    sourcePath: filePath,
    size: buffer.byteLength,
    sha256,
  });

  await mkdir(modelDir(record.uuid), { recursive: true });
  await writeFile(modelBinaryPath(record.uuid, record.format), buffer);
  await persistEmbeddedThumbnail(record);
  await writeJson(modelMetadataPath(record.uuid), record);
  invalidateModelRecordsCache();

  return { record, wasDeduped: false };
}

async function persistEmbeddedThumbnail(record) {
  const thumbnail = parseThumbnailDataUrl(record.thumbnail);
  if (!thumbnail) return;
  const thumbnailUpdatedAt = new Date().toISOString();
  await writeFile(modelThumbnailPath(record.uuid, thumbnail.extension), Buffer.from(thumbnail.data, 'base64'));
  record.thumbnail = `/api/models/${encodeURIComponent(record.uuid)}/thumbnail?v=${encodeURIComponent(thumbnailUpdatedAt)}`;
  record.thumbnailFormat = thumbnail.format;
  record.thumbnailUpdatedAt = thumbnailUpdatedAt;
}

async function updateModel(uuid, updates) {
  const existing = await getModelRecord(uuid);
  if (!existing) return null;
  const { thumbnailDataUrl, ...metadataUpdates } = updates;
  const thumbnail = parseThumbnailDataUrl(thumbnailDataUrl);
  const thumbnailUpdatedAt = thumbnail ? new Date().toISOString() : undefined;

  if (thumbnail) {
    await mkdir(modelDir(uuid), { recursive: true });
    await writeFile(modelThumbnailPath(uuid, thumbnail.extension), Buffer.from(thumbnail.data, 'base64'));
  }

  const record = buildModelRecord(
    {
      ...existing,
      ...metadataUpdates,
      uuid,
      format: metadataUpdates.format ?? existing.format,
      size: metadataUpdates.size ?? existing.size,
      ...(thumbnail
        ? {
            thumbnail: `/api/models/${encodeURIComponent(uuid)}/thumbnail?v=${encodeURIComponent(thumbnailUpdatedAt)}`,
            thumbnailFormat: thumbnail.format,
            thumbnailUpdatedAt,
          }
        : {}),
    },
    existing,
  );

  await writeJson(modelMetadataPath(uuid), record);
  invalidateModelRecordsCache();
  return record;
}

function generatedAssetRootForPath(filePath) {
  const resolved = resolvePathInsideRoots(filePath, DELETABLE_ASSET_ROOTS);
  if (!resolved) return null;

  const generatedRoot = path.resolve('/tank/asset-library/assets/generated');
  if (!isPathWithin(resolved, generatedRoot)) return null;

  const relative = path.relative(generatedRoot, resolved).split(path.sep).filter(Boolean);
  if (relative.length < 2) return null;
  return path.join(generatedRoot, relative[0], relative[1]);
}

function catalogPackRootForRecord(record) {
  if (record?.metadata?.isProductPack === true) return null;
  const sourceCatalog = record?.metadata?.sourceCatalog;
  const catalogPath = resolvePathInsideRoots(sourceCatalog, DELETABLE_ASSET_ROOTS);
  if (!catalogPath) return null;
  const assetForgeRoot = path.resolve('/tank/3d-catalog/assetforge-props');
  if (!isPathWithin(catalogPath, assetForgeRoot)) return null;
  const relative = path.relative(assetForgeRoot, catalogPath).split(path.sep).filter(Boolean);
  if (!relative[0]) return null;
  return path.join(assetForgeRoot, relative[0]);
}

function targetKey(filePath) {
  return path.resolve(filePath);
}

function sourcePathReferenceCount(records, sourcePath, excludingUuids = new Set()) {
  const resolved = path.resolve(sourcePath);
  return records.filter((record) => (
    record?.sourcePath &&
    path.resolve(record.sourcePath) === resolved &&
    !excludingUuids.has(record.uuid)
  )).length;
}

async function archiveDeletedAssetPath(filePath, reason, deletedAt) {
  const resolved = resolvePathInsideRoots(filePath, DELETABLE_ASSET_ROOTS);
  if (!resolved) return null;

  try {
    await stat(resolved);
  } catch {
    return null;
  }

  const safeName = resolved
    .replace(/^\/+/, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '__');
  const archiveDir = path.join(DELETED_ASSETS_DIR, deletedAt);
  const destination = path.join(archiveDir, safeName);
  await mkdir(path.dirname(destination), { recursive: true });
  try {
    await rename(resolved, destination);
  } catch (err) {
    if (err?.code !== 'EXDEV') throw err;
    await cp(resolved, destination, { recursive: true, force: true });
    await rm(resolved, { recursive: true, force: true });
  }
  return { source: resolved, archivedTo: destination, reason };
}

async function deleteModelRecordAndOwnedAssets(uuid) {
  const record = await getModelRecord(uuid);
  if (!record) return { deletedUuids: [], archived: [], missing: true };

  const allRecords = await listModelRecords();
  const uuidsToDelete = new Set([uuid]);
  const sourcePath = record.sourcePath && typeof record.sourcePath === 'string' ? record.sourcePath : null;
  const generatedRoot = sourcePath ? generatedAssetRootForPath(sourcePath) : null;

  if (generatedRoot && record.assetGroupId) {
    for (const candidate of allRecords) {
      if (candidate.assetGroupId === record.assetGroupId || candidate.packSlug === record.packSlug) {
        uuidsToDelete.add(candidate.uuid);
      }
    }
  }

  const recordsToDelete = allRecords.filter((candidate) => uuidsToDelete.has(candidate.uuid));
  const deletedAt = new Date().toISOString().replace(/[:.]/g, '-');
  const targets = new Map();

  if (generatedRoot) {
    targets.set(targetKey(generatedRoot), { path: generatedRoot, reason: 'generated asset root' });
  }

  for (const candidate of recordsToDelete) {
    if (candidate.sourcePath) {
      const deletableSource = resolvePathInsideRoots(candidate.sourcePath, DELETABLE_ASSET_ROOTS);
      if (
        deletableSource &&
        !generatedRoot &&
        sourcePathReferenceCount(allRecords, deletableSource, uuidsToDelete) === 0
      ) {
        targets.set(targetKey(deletableSource), { path: deletableSource, reason: 'model source file' });
      }
    }

    const catalogRoot = catalogPackRootForRecord(candidate);
    if (catalogRoot) {
      targets.set(targetKey(catalogRoot), { path: catalogRoot, reason: 'non-product catalog pack' });
    }
  }

  const archived = [];
  for (const target of targets.values()) {
    const result = await archiveDeletedAssetPath(target.path, target.reason, deletedAt);
    if (result) archived.push(result);
  }

  await Promise.all([...uuidsToDelete].map((id) => rm(modelDir(id), { recursive: true, force: true })));
  invalidateModelRecordsCache();
  return { deletedUuids: [...uuidsToDelete], archived, missing: false };
}

async function sendModelFile(res, uuid, { head = false } = {}) {
  const record = await getModelRecord(uuid);
  if (!record) return error(res, 404, `Model ${uuid} not found`);

  const filePath = record.sourcePath && await fileExists(record.sourcePath)
    ? record.sourcePath
    : modelBinaryPath(uuid, record.format);
  try {
    const info = await stat(filePath);
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': record.format === 'gltf' ? 'model/gltf+json' : 'model/gltf-binary',
      'Content-Length': info.size,
      'Content-Disposition': `attachment; filename="${record.name}.${record.format}"`,
    });
    res.end(head ? undefined : await readFile(filePath));
  } catch {
    error(res, 404, `Model file for ${uuid} not found`);
  }
}

async function sendModelThumbnail(res, uuid, { head = false } = {}) {
  const record = await getModelRecord(uuid);
  if (!record) return error(res, 404, `Model ${uuid} not found`);

  const candidates = [
    record.thumbnailFormat === 'jpeg' ? 'jpg' : record.thumbnailFormat,
    'png',
    'jpg',
    'webp',
  ].filter(Boolean);

  for (const extension of candidates) {
    const filePath = modelThumbnailPath(uuid, extension);
    try {
      const info = await stat(filePath);
      const contentType = extension === 'jpg' ? 'image/jpeg' : `image/${extension}`;
      res.writeHead(200, {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store',
        'Content-Type': contentType,
        'Content-Length': info.size,
      });
      res.end(head ? undefined : await readFile(filePath));
      return undefined;
    } catch {
      // Try the next supported thumbnail extension.
    }
  }

  return error(res, 404, `Thumbnail for ${uuid} not found`);
}

function resolveSafeHillFile(filePath) {
  if (!filePath || typeof filePath !== 'string') return null;
  const resolved = path.resolve(filePath);
  const isAllowed = SAFE_HILL_FILE_ROOTS.some((root) => resolved === root || resolved.startsWith(`${root}${path.sep}`));
  return isAllowed ? resolved : null;
}

async function sendLocalHillFile(res, filePath, { head = false } = {}) {
  const resolved = resolveSafeHillFile(filePath);
  if (!resolved) return error(res, 403, 'Requested file is outside allowed Hill asset roots');

  const extension = path.extname(resolved).toLowerCase();
  const contentType = LOCAL_IMAGE_CONTENT_TYPES.get(extension);
  if (!contentType) return error(res, 415, `Unsupported local asset preview type: ${extension || 'unknown'}`);

  try {
    const info = await stat(resolved);
    if (!info.isFile()) return error(res, 404, 'Requested asset preview is not a file');
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store',
      'Content-Type': contentType,
      'Content-Length': info.size,
    });
    res.end(head ? undefined : await readFile(resolved));
    return undefined;
  } catch {
    return error(res, 404, 'Requested asset preview was not found');
  }
}

async function createHillRegenJob(body) {
  const modelUuid = body?.modelUuid;
  if (!modelUuid || typeof modelUuid !== 'string') {
    throw new Error('modelUuid is required');
  }

  const record = await getModelRecord(modelUuid);
  if (!record) {
    throw new Error(`Model ${modelUuid} not found`);
  }

  const now = new Date().toISOString();
  const id = randomUUID();
  const packSlug = record.packSlug ?? record.assetGroupId?.split(':')[0] ?? null;
  const manifestPath = packSlug
    ? `/tank/3d-catalog/assetforge-props/${packSlug}/unified_manifest.json`
    : null;

  const job = {
    id,
    type: 'hill.regen_asset',
    status: 'queued',
    createdAt: now,
    updatedAt: now,
    sourceModelUuid: record.uuid,
    sourceModelName: record.name,
    assetGroupId: record.assetGroupId ?? null,
    lodTier: record.lodTier ?? null,
    packSlug,
    packName: record.packName ?? null,
    qualityTier: record.qualityTier ?? null,
    reviewStatus: record.reviewStatus ?? null,
    sourcePath: record.sourcePath ?? null,
    manifestPath,
    reason: typeof body.reason === 'string'
      ? body.reason
      : record.reviewStatus === 'needs_regen'
        ? 'review_status_needs_regen'
        : '',
    promptHint: typeof body.promptHint === 'string' ? body.promptHint : record.description ?? '',
    generateLods: body?.generateLods !== false,
    exportTarget: 'library',
    seed: Number.isFinite(Number(body.seed)) ? Number(body.seed) : Math.floor(Math.random() * 2 ** 31),
    outRoot: '/tank/3d/conjured_assets',
    requestedBy: 'vrmviewer',
    pipeline: {
      provider: 'hill_local_dgx',
      promptModel: 'nemotron',
      imageModel: 'flux_klein',
      meshModel: 'trellis2',
      implementation: 'bruno_comfyui',
    },
  };

  await mkdir(HILL_REGEN_JOBS_DIR, { recursive: true });
  await updateHillRegenJob(job);
  runHillRegenJob(job);
  return job;
}

function parseLastJsonObject(text) {
  const trimmed = String(text ?? '').trim();
  const start = trimmed.lastIndexOf('\n{');
  const jsonText = start >= 0 ? trimmed.slice(start + 1) : trimmed;
  return JSON.parse(jsonText);
}

async function updateHillConjureJob(job) {
  job.updatedAt = new Date().toISOString();
  await mkdir(HILL_CONJURE_JOBS_DIR, { recursive: true });
  await writeJson(hillConjureJobPath(job.id), job);
}

async function updateHillRegenJob(job) {
  job.updatedAt = new Date().toISOString();
  await mkdir(HILL_REGEN_JOBS_DIR, { recursive: true });
  await writeJson(hillRegenJobPath(job.id), job);
}

async function importConjuredAsset(job, result) {
  const stem = result.stem || slugify(job.name || job.prompt || 'conjured_asset');
  const lodDir = typeof result.lod_dir === 'string' ? result.lod_dir : '';
  const glbPath = result.glb;
  if (!glbPath || typeof glbPath !== 'string') {
    throw new Error('Hill conjure result did not include a GLB path');
  }
  const buffer = await readFile(glbPath);
  const sha256 = createHash('sha256').update(buffer).digest('hex');
  const name = job.name || stem || 'Conjured asset';
  const exportTarget = job.exportTarget ?? result.exportTarget ?? 'library';
  const packName = name.replace(/_/g, ' ').replace(/\b\w/g, (value) => value.toUpperCase());
  const tags = assetTagsForRecord({
    name,
    description: job.prompt,
    category: exportTarget === 'game' ? 'game asset' : exportTarget === 'store' ? 'store asset' : job.mode,
    prompt: job.prompt,
  });
  const payload = {
    name,
    displayName: name,
    description: job.prompt,
    category: exportTarget === 'game' ? 'game_asset' : exportTarget === 'store' ? 'store_asset' : job.mode,
    tags,
    format: 'glb',
    version: '1.0',
    author: 'Hill / DGX Spark',
    license: exportTarget === 'store' ? 'cc0' : 'platform_public_license',
    size: buffer.byteLength,
    sha256,
    isHumanoid: false,
    polyBucket: job.mode === 'conjure' ? 'mid' : undefined,
    searchTokens: [name, job.prompt, ...tags].join(' ').toLowerCase().split(/\s+/),
    sourcePath: glbPath,
    assetGroupId: stem,
    lodTier: 'default',
    packSlug: stem,
    packName,
    qualityTier: result.qualityTier ?? (exportTarget === 'store' || exportTarget === 'game' ? 'game_ready' : 'draft'),
    reviewStatus: result.reviewStatus ?? 'pending',
    metadata: {
      title: name,
      version: '1.0',
      author: 'Hill / DGX Spark',
      prompt: job.prompt,
      refImage: result.ref_image,
      pipelineMode: job.mode,
      pipelineType: result.pipeline_type,
      quality: result.quality,
      pipeline: {
        provider: 'hill_local_dgx',
        imageModel: 'flux',
        meshModel: 'trellis2',
      },
      generatedLods: result.generatedLods ?? job.generateLods,
      exportTarget,
      originalSourcePath: result.glb,
      lodDir: result.lod_dir,
      sourceRegenJobId: job.type === 'hill.regen_asset' ? job.id : undefined,
      sourceModelUuid: job.sourceModelUuid,
      sourceModelName: job.sourceModelName,
    },
    dataBase64: buffer.toString('base64'),
  };
  const { record } = await saveModel(payload, { skipDedup: true });
  record.lodModelUuids = await importConjuredLodRecords(job, result, record);
  await writeJson(modelMetadataPath(record.uuid), record);
  return record;
}

async function importConjuredLodRecords(job, result, sourceRecord) {
  const lodDir = typeof result.lod_dir === 'string' ? result.lod_dir : '';
  if (!lodDir) return [];

  const stem = result.stem || sourceRecord.packSlug || sourceRecord.assetGroupId || slugify(sourceRecord.name);
  const entries = await readdir(lodDir, { withFileTypes: true }).catch(() => []);
  const lodFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.glb'))
    .map((entry) => path.join(lodDir, entry.name))
    .sort();

  const imported = [];
  for (const filePath of lodFiles) {
    const basename = path.basename(filePath, '.glb');
    const tierMatch = basename.match(/_(default|lod[0-3])$/i);
    const tier = tierMatch ? tierMatch[1].toLowerCase() : 'default';
    if (tier === 'default') continue;
    const existing = await findBySourcePath(filePath);
    if (existing) {
      imported.push({ tier, uuid: existing.uuid, wasDeduped: true });
      continue;
    }

    const buffer = await readFile(filePath);
    const sha256 = createHash('sha256').update(buffer).digest('hex');
    const name = `${sourceRecord.packName ?? sourceRecord.name} ${tier.toUpperCase()}`;
    const tags = [...new Set([...(sourceRecord.tags ?? []), tier].filter(Boolean))];
    const { record, wasDeduped } = await saveModel({
      name,
      displayName: name,
      description: sourceRecord.description ?? job.prompt ?? '',
      category: sourceRecord.category,
      tags,
      format: 'glb',
      version: sourceRecord.version ?? '1.0',
      author: sourceRecord.author,
      license: sourceRecord.license,
      size: buffer.byteLength,
      sha256,
      isHumanoid: false,
      searchTokens: [sourceRecord.name, job.prompt, tier, ...tags]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .split(/\s+/),
      sourcePath: filePath,
      assetGroupId: stem,
      lodTier: tier,
      packSlug: stem,
      packName: sourceRecord.packName ?? sourceRecord.name,
      qualityTier: sourceRecord.qualityTier,
      reviewStatus: sourceRecord.reviewStatus,
      metadata: {
        ...(sourceRecord.metadata ?? {}),
        lodTier: tier,
        sourceModelUuid: sourceRecord.uuid,
      },
      dataBase64: buffer.toString('base64'),
    }, { skipDedup: true });
    imported.push({ tier, uuid: record.uuid, wasDeduped });
  }

  return imported;
}

function runHillConjureJob(job) {
  void enqueueHillGpuJob(`conjure:${job.id}`, async () => {
    job.status = 'running';
    await updateHillConjureJob(job);

    try {
      const args = [
        HILL_CONJURE_SCRIPT,
        '--prompt', job.prompt,
        '--mode', job.mode,
        '--seed', String(job.seed),
        '--out-root', job.outRoot,
        '--export-target', job.exportTarget,
        '--json',
      ];
      if (job.name) args.push('--name', job.name);
      if (job.quality) args.push('--quality', job.quality);
      if (job.steps) args.push('--steps', String(job.steps));
      if (job.noRembg) args.push('--no-rembg');
      if (!job.generateLods) args.push('--no-lods');

      const { stdout } = await runHillScript(
        args,
        path.join(HILL_CONJURE_JOBS_DIR, `${job.id}.log`),
        'Hill conjure',
      );
      const result = parseLastJsonObject(stdout);
      const record = await importConjuredAsset(job, result);
      job.status = 'completed';
      job.result = result;
      job.assetId = record.uuid;
      job.assetName = record.name;
      const source = await getModelRecord(job.sourceModelUuid);
      if (source) {
        await updateModel(source.uuid, {
          latestRegenJobId: job.id,
          supersededByModelUuid: record.uuid,
          supersededByModelName: record.name,
          reviewStatus: 'rejected',
          metadata: {
            ...(source.metadata ?? {}),
            supersededByModelUuid: record.uuid,
            supersededByModelName: record.name,
            latestRegenJobId: job.id,
            supersededAt: new Date().toISOString(),
          },
        });
      }
    } catch (err) {
      job.status = 'failed';
      job.error = err instanceof Error ? err.message : String(err);
    } finally {
      await updateHillConjureJob(job);
    }
  });
}

function runHillRegenJob(job) {
  void enqueueHillGpuJob(`regen:${job.id}`, async () => {
    const prompt = String(job.promptHint || job.sourceModelName || '').trim();
    if (!prompt) {
      job.status = 'failed';
      job.error = 'Regen job has no promptHint or source model name';
      await updateHillRegenJob(job);
      return;
    }

    job.status = 'running';
    await updateHillRegenJob(job);

    try {
      const isBuilding = looksLikeBuildingPrompt(prompt);
      const regenName = `${slugify(job.sourceModelName)}_regen_${job.id.slice(0, 8)}`;
      const args = [
        HILL_CONJURE_SCRIPT,
        '--prompt', prompt,
        '--mode', 'create',
        '--seed', String(job.seed),
        '--out-root', job.outRoot,
        '--export-target', 'library',
        '--name', regenName,
        '--quality', isBuilding ? 'high' : 'medium',
        '--json',
      ];
      if (isBuilding) args.push('--no-rembg');
      if (!job.generateLods) args.push('--no-lods');

      const { stdout } = await runHillScript(
        args,
        path.join(HILL_REGEN_JOBS_DIR, `${job.id}.log`),
        'Hill regen',
      );
      const result = parseLastJsonObject(stdout);
      const record = await importConjuredAsset({
        ...job,
        prompt,
        name: regenName,
        mode: 'create',
        exportTarget: 'library',
        generateLods: job.generateLods,
      }, result);
      job.status = 'completed';
      job.result = result;
      job.assetId = record.uuid;
      job.assetName = record.name;
    } catch (err) {
      job.status = 'failed';
      job.error = err instanceof Error ? err.message : String(err);
    } finally {
      await updateHillRegenJob(job);
    }
  });
}

async function updateHillExportJob(job) {
  job.updatedAt = new Date().toISOString();
  await mkdir(HILL_EXPORT_JOBS_DIR, { recursive: true });
  await writeJson(hillExportJobPath(job.id), job);
}

function exportRootForTarget(target) {
  if (target === 'game') return '/tank/3d/game_asset_store';
  if (target === 'store') return '/tank/3d/marketplace_store';
  return '/tank/3d/conjured_assets';
}

async function createHillExportJob(body) {
  const modelUuid = typeof body?.modelUuid === 'string' ? body.modelUuid : '';
  if (!modelUuid) throw new Error('modelUuid is required');
  const record = await getModelRecord(modelUuid);
  if (!record) throw new Error(`Model ${modelUuid} not found`);

  const destination = ['library', 'store', 'game'].includes(body?.destination) ? body.destination : 'game';
  const now = new Date().toISOString();
  const id = randomUUID();
  const name = typeof body?.name === 'string' && body.name.trim() ? body.name.trim() : record.displayName ?? record.name;
  const slug = slugify(body?.slug ?? name);
  const outRoot = path.join(exportRootForTarget(destination), slug);
  const meshesDir = path.join(outRoot, 'meshes');
  const sourcePath = record.sourcePath && typeof record.sourcePath === 'string'
    ? record.sourcePath
    : modelBinaryPath(record.uuid, record.format);

  const metadata = {
    title: name,
    description: typeof body?.description === 'string' ? body.description : record.description ?? '',
    author: typeof body?.author === 'string' ? body.author : record.author ?? '',
    version: typeof body?.version === 'string' ? body.version : record.version ?? '1.0',
    category: typeof body?.category === 'string' ? body.category : record.category ?? '',
    keywords: Array.isArray(body?.keywords) ? body.keywords.map(String).filter(Boolean) : record.tags ?? [],
    license: typeof body?.license === 'string' ? body.license : record.license ?? '',
    visibility: typeof body?.visibility === 'string' ? body.visibility : destination === 'store' ? 'private_commercial' : 'platform_curated',
    commercialUse: body?.commercialUse === true,
    priceUsd: typeof body?.priceUsd === 'string' ? body.priceUsd : '',
  };

  const job = {
    id,
    type: 'hill.export_asset',
    status: 'queued',
    createdAt: now,
    updatedAt: now,
    modelUuid: record.uuid,
    sourcePath,
    sourceModelName: record.name,
    destination,
    generateLods: body?.generateLods !== false,
    withKtx2: body?.withKtx2 !== false,
    withLod3: body?.withLod3 !== false,
    marketplacePackage: body?.marketplacePackage === true || destination === 'store',
    createGumroadDraft: body?.createGumroadDraft === true,
    autoUploadGumroad: body?.autoUploadGumroad === true,
    publishGumroad: body?.publishGumroad === true,
    outRoot,
    meshesDir,
    slug,
    metadata,
    requestedBy: 'vrmviewer',
  };

  await updateHillExportJob(job);
  runHillExportJob(job);
  return job;
}

async function enrichModelRecord(body) {
  const modelUuid = typeof body?.modelUuid === 'string' ? body.modelUuid : '';
  if (!modelUuid) throw new Error('modelUuid is required');
  const record = await getModelRecord(modelUuid);
  if (!record) throw new Error(`Model ${modelUuid} not found`);

  const now = new Date().toISOString();
  const id = randomUUID();
  const destination = body?.destination === 'game' ? 'game' : 'store';
  const job = {
    id,
    type: 'hill.enrich_asset',
    status: 'running',
    createdAt: now,
    updatedAt: now,
    modelUuid: record.uuid,
    sourcePath: record.sourcePath ?? modelBinaryPath(record.uuid, record.format),
    sourceModelName: record.name,
    destination,
    slug: slugify(record.packSlug ?? record.name),
    metadata: {
      title: record.displayName ?? record.name,
      description: record.description ?? record.metadata?.description ?? '',
      author: record.author ?? '',
      version: record.version ?? '1.0',
      category: record.category ?? '',
      keywords: Array.isArray(record.tags) ? record.tags : [],
      license: record.license ?? '',
      visibility: destination === 'store' ? 'private_commercial' : 'platform_curated',
      commercialUse: true,
      priceUsd: typeof record.priceUsd === 'number' ? String(record.priceUsd) : '',
      textureSize: record.textureSize,
      polycount: record.polycount,
    },
    requestedBy: 'vrmviewer',
  };

  await updateHillExportJob(job);
  const enriched = await runHillExportEnrichment(job);
  job.status = 'completed';
  job.enriched = enriched;
  await updateHillExportJob(job);

  const keywords = Array.isArray(enriched.keywords) ? enriched.keywords.map(String) : job.metadata.keywords;
  const updated = await updateModel(record.uuid, {
    description: enriched.description ?? record.description,
    tags: keywords,
    searchTokens: [record.name, enriched.title, enriched.description, ...(keywords ?? [])]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .split(/\s+/),
    marketplaceCopy: destination === 'store' ? enriched.copy ?? record.marketplaceCopy : record.marketplaceCopy,
    priceUsd: destination === 'store' && enriched.price_usd ? Number(enriched.price_usd) : record.priceUsd,
    latestEnrichJobId: job.id,
    metadata: {
      ...(record.metadata ?? {}),
      title: enriched.title ?? record.metadata?.title,
      description: enriched.description ?? record.metadata?.description,
      keywords,
      marketplaceCopy: destination === 'store' ? enriched.copy : record.metadata?.marketplaceCopy,
      priceUsd: destination === 'store' ? enriched.price_usd : record.metadata?.priceUsd,
      latestEnrichJobId: job.id,
    },
  });

  return { job, record: updated };
}

function runHillExportJob(job) {
  void (async () => {
    try {
      job.status = 'running';
      await updateHillExportJob(job);

      try {
        const enriched = await runHillExportEnrichment(job);
        job.enriched = enriched;
        job.metadata = {
          ...job.metadata,
          title: enriched.title ?? job.metadata.title,
          description: enriched.description ?? job.metadata.description,
          keywords: enriched.keywords ?? job.metadata.keywords,
          priceUsd: String(enriched.price_usd ?? job.metadata.priceUsd ?? ''),
        };
      } catch (err) {
        job.enrichmentError = err instanceof Error ? err.message : String(err);
      }
      await updateHillExportJob(job);

      await mkdir(job.meshesDir, { recursive: true });
      const sourceGlb = path.join(job.meshesDir, `${job.slug}.glb`);
      await copyFile(job.sourcePath, sourceGlb);
      job.copiedGlb = sourceGlb;

      if (job.generateLods) {
        const lodDir = path.join(job.meshesDir, '_lod');
        await mkdir(lodDir, { recursive: true });
        await new Promise((resolve, reject) => {
          const child = spawn(HILL_LOD_SCRIPT, [sourceGlb, lodDir], {
            cwd: HILL_ROOT,
            env: {
              ...process.env,
              WITH_KTX2: job.withKtx2 ? '1' : '0',
              WITH_LOD3: job.withLod3 ? '1' : '0',
            },
            stdio: ['ignore', 'pipe', 'pipe'],
          });
          let stdout = '';
          let stderr = '';
          child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
          child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
          child.on('error', reject);
          child.on('close', async (code) => {
            await writeFile(path.join(HILL_EXPORT_JOBS_DIR, `${job.id}.log`), `${stdout}\n${stderr}`);
            if (code === 0) resolve(undefined);
            else reject(new Error(`LOD export exited ${code}: ${stderr.trim() || stdout.trim()}`));
          });
        });
        job.lodDir = lodDir;
      }

      const manifest = {
        schema_version: '1.0',
        kind: 'hill.exported_asset',
        id: job.slug,
        pipeline: job.destination === 'game' ? 'game_deploy' : 'marketplace_product',
        destination: job.destination,
        generated_at: new Date().toISOString(),
        source_model_uuid: job.modelUuid,
        metadata: job.metadata,
        enriched: job.enriched ?? null,
        files: {
          source_glb: job.copiedGlb,
          lod_dir: job.lodDir ?? null,
        },
      };
      const manifestPath = path.join(job.outRoot, 'manifest.json');
      await writeJson(manifestPath, manifest);
      job.manifestPath = manifestPath;
      if (job.marketplacePackage) {
        job.marketplace = await runHillMarketplacePackage(job);
      }
      job.status = 'completed';
      job.lodModelUuids = await importExportLodRecords(job);
      await syncExportToModelRecord(job);
    } catch (err) {
      job.status = 'failed';
      job.error = err instanceof Error ? err.message : String(err);
      await syncExportToModelRecord(job);
    }
    await updateHillExportJob(job);
  })();
}

async function runHillMarketplacePackage(job) {
  if (!job.manifestPath) {
    throw new Error('Marketplace package requires a completed export manifest');
  }
  return await new Promise((resolve, reject) => {
    const args = [
      HILL_MARKETPLACE_PACKAGE_SCRIPT,
      '--manifest', job.manifestPath,
      '--json',
    ];
    if (job.createGumroadDraft) args.push('--create-gumroad-draft');
    if (job.autoUploadGumroad) args.push('--auto-upload-gumroad');
    if (job.publishGumroad) args.push('--publish');

    const child = spawn('python3', args, {
      cwd: HILL_ROOT,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', reject);
    child.on('close', async (code) => {
      await writeFile(path.join(HILL_EXPORT_JOBS_DIR, `${job.id}.marketplace.log`), `${stdout}\n${stderr}`);
      if (code !== 0) {
        reject(new Error(`Marketplace package exited ${code}: ${stderr.trim() || stdout.trim()}`));
        return;
      }
      try {
        resolve(parseLastJsonObject(stdout));
      } catch (err) {
        reject(err);
      }
    });
  });
}

async function importExportLodRecords(job) {
  if (!job.lodDir) return [];

  const sourceRecord = await getModelRecord(job.modelUuid);
  if (!sourceRecord) return [];

  const entries = await readdir(job.lodDir, { withFileTypes: true }).catch(() => []);
  const lodFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.glb'))
    .map((entry) => path.join(job.lodDir, entry.name))
    .sort();

  const imported = [];
  const groupId = sourceRecord.assetGroupId ?? `${job.slug}:export-lods`;
  const keywords = Array.isArray(job.metadata?.keywords)
    ? job.metadata.keywords.map(String)
    : assetTagsForRecord({
        name: job.metadata?.title ?? sourceRecord.name,
        description: job.metadata?.description ?? sourceRecord.description,
        category: job.metadata?.category ?? sourceRecord.category,
      });

  for (const filePath of lodFiles) {
    const basename = path.basename(filePath, '.glb');
    const tierMatch = basename.match(/_(default|lod[0-3])$/i);
    const tier = tierMatch ? tierMatch[1].toLowerCase() : 'default';
    if (tier === 'default') continue;
    const tierLabel = tier === 'default' ? 'default' : tier.toUpperCase();
    const existing = await findBySourcePath(filePath);

    const payload = {
      name: `${job.metadata?.title ?? sourceRecord.name} ${tierLabel}`,
      displayName: `${job.metadata?.title ?? sourceRecord.displayName ?? sourceRecord.name} ${tierLabel}`,
      description: job.metadata?.description ?? sourceRecord.description ?? '',
      category: job.metadata?.category ?? sourceRecord.category ?? '',
      tags: [...new Set([...keywords, tier].filter(Boolean))],
      version: job.metadata?.version ?? sourceRecord.version ?? '1.0',
      author: job.metadata?.author ?? sourceRecord.author ?? '',
      license: job.metadata?.license ?? sourceRecord.license ?? '',
      thumbnail: sourceRecord.thumbnail,
      thumbnailFormat: sourceRecord.thumbnailFormat,
      assetGroupId: groupId,
      lodTier: tier,
      packSlug: sourceRecord.packSlug ?? job.slug,
      packName: sourceRecord.packName ?? job.metadata?.title ?? sourceRecord.name,
      qualityTier: 'game_ready',
      reviewStatus: job.status === 'completed' ? 'approved' : sourceRecord.reviewStatus,
      isHumanoid: false,
      searchTokens: [
        sourceRecord.name,
        job.metadata?.title,
        tier,
        ...(keywords ?? []),
      ].filter(Boolean).join(' ').toLowerCase().split(/\s+/),
      exports: {
        ...(sourceRecord.exports ?? {}),
        [job.destination]: {
          jobId: job.id,
          destination: job.destination,
          status: job.status,
          manifestPath: job.manifestPath,
          sourceGlb: filePath,
          lodDir: job.lodDir,
          exportedAt: new Date().toISOString(),
          error: job.error,
        },
      },
      metadata: {
        ...(sourceRecord.metadata ?? {}),
        ...(job.metadata ?? {}),
        sourceModelUuid: sourceRecord.uuid,
        sourceModelName: sourceRecord.name,
        exportTarget: job.destination,
        exportManifestPath: job.manifestPath,
        lodDir: job.lodDir,
        lodTier: tier,
      },
    };

    const { record } = existing
      ? { record: await updateModel(existing.uuid, payload) }
      : await saveModelFromFile(filePath, payload);
    if (record?.uuid) imported.push(record.uuid);
  }

  return imported;
}

async function syncExportToModelRecord(job) {
  const existing = await getModelRecord(job.modelUuid);
  if (!existing) return;

  const destination = job.destination === 'store' ? 'store' : job.destination === 'game' ? 'game' : null;
  if (!destination) return;

  const enriched = job.enriched && typeof job.enriched === 'object' ? job.enriched : {};
  const keywords = Array.isArray(enriched.keywords) ? enriched.keywords.map(String) : job.metadata?.keywords;
  const assetGroupId = existing.assetGroupId ?? `${job.slug}:export-lods`;
  const exports = {
    ...(existing.exports ?? {}),
    [destination]: {
      jobId: job.id,
      destination: job.destination,
      status: job.status,
      manifestPath: job.manifestPath,
      sourceGlb: job.copiedGlb,
      lodDir: job.lodDir,
      marketplace: job.marketplace,
      exportedAt: new Date().toISOString(),
      error: job.error,
    },
  };

  await updateModel(existing.uuid, {
    exports,
    latestExportJobId: job.id,
    description: enriched.description ?? job.metadata?.description ?? existing.description,
    tags: keywords ?? existing.tags,
    searchTokens: [existing.name, enriched.title, enriched.description, ...(keywords ?? [])]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .split(/\s+/),
    marketplaceCopy: destination === 'store' ? enriched.copy ?? existing.marketplaceCopy : existing.marketplaceCopy,
    priceUsd: destination === 'store' && enriched.price_usd ? Number(enriched.price_usd) : existing.priceUsd,
    assetGroupId,
    lodTier: existing.lodTier ?? 'default',
    qualityTier: job.generateLods ? 'game_ready' : existing.qualityTier,
    reviewStatus: job.status === 'completed' ? 'approved' : existing.reviewStatus,
    metadata: {
      ...(existing.metadata ?? {}),
      ...(job.metadata ?? {}),
      exportTarget: job.destination,
      exportManifestPath: job.manifestPath,
      lodDir: job.lodDir,
      marketplaceCopy: destination === 'store' ? enriched.copy : existing.metadata?.marketplaceCopy,
      marketplacePackage: destination === 'store' ? job.marketplace : existing.metadata?.marketplacePackage,
      priceUsd: destination === 'store' ? enriched.price_usd : existing.metadata?.priceUsd,
    },
  });
}

async function runHillExportEnrichment(job) {
  await updateHillExportJob(job);
  return await new Promise((resolve, reject) => {
    const child = spawn('python3', [HILL_ENRICH_EXPORT_SCRIPT, '--job', hillExportJobPath(job.id)], {
      cwd: HILL_ROOT,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', reject);
    child.on('close', async (code) => {
      await writeFile(path.join(HILL_EXPORT_JOBS_DIR, `${job.id}.enrich.log`), `${stdout}\n${stderr}`);
      if (code !== 0) {
        reject(new Error(`Hill export enrichment exited ${code}: ${stderr.trim() || stdout.trim()}`));
        return;
      }
      try {
        resolve(parseLastJsonObject(stdout));
      } catch (err) {
        reject(err);
      }
    });
  });
}

async function createHillConjureJob(body) {
  const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';
  if (!prompt) {
    throw new Error('prompt is required');
  }
  const mode = ['conjure', 'create', 'store'].includes(body?.mode) ? body.mode : 'conjure';
  const isFastConjure = mode === 'conjure';
  const quality = ['medium', 'high'].includes(body?.quality)
    ? body.quality
    : body?.quality === 'low'
      ? 'medium'
      : 'medium';
  const defaultExportTarget = isFastConjure ? 'game' : 'library';
  const exportTarget = ['library', 'store', 'game'].includes(body?.exportTarget)
    ? body.exportTarget
    : defaultExportTarget;
  const steps = Number(body?.steps);
  const autoNoRembg = mode !== 'conjure' && looksLikeBuildingPrompt(prompt);
  const now = new Date().toISOString();
  const id = randomUUID();
  const job = {
    id,
    type: 'hill.conjure_asset',
    status: 'queued',
    createdAt: now,
    updatedAt: now,
    prompt,
    name: typeof body.name === 'string' ? body.name.trim() : '',
    mode,
    quality,
    steps: Number.isInteger(steps) && steps >= 4 && steps <= 32 ? steps : 12,
    noRembg: body?.noRembg === true || autoNoRembg,
    autoNoRembg,
    generateLods: body?.generateLods !== false,
    exportTarget,
    seed: Number.isFinite(Number(body.seed)) ? Number(body.seed) : Math.floor(Math.random() * 2 ** 31),
    outRoot: typeof body.outRoot === 'string' ? body.outRoot : '/tank/3d/conjured_assets',
    pipeline: {
      provider: 'hill_local_dgx',
      profile: isFastConjure ? 'fast_conjure' : 'asset_generation',
      promptOptimization: isFastConjure ? 'disabled' : 'local_asset_framing',
      promptModel: isFastConjure ? 'none' : 'local_asset_framing',
      imageModel: 'flux_klein',
      meshModel: 'trellis2',
      implementation: 'bruno_comfyui',
      pipelineType: '1024',
      textureSize: 2048,
      cascade: false,
    },
  };
  await updateHillConjureJob(job);
  runHillConjureJob(job);
  return job;
}

async function resumeQueuedHillJobs() {
  const [regenJobs, conjureJobs] = await Promise.all([
    listHillRegenJobs(),
    listHillConjureJobs(),
  ]);
  const pending = [
    ...regenJobs
      .filter((job) => job.status === 'queued' || job.status === 'running')
      .map((job) => ({ kind: 'regen', job })),
    ...conjureJobs
      .filter((job) => job.status === 'queued' || job.status === 'running')
      .map((job) => ({ kind: 'conjure', job })),
  ].sort((a, b) => new Date(a.job.createdAt).getTime() - new Date(b.job.createdAt).getTime());

  for (const item of pending) {
    item.job.status = 'queued';
    item.job.resumedAt = new Date().toISOString();
    if (item.kind === 'regen') {
      await updateHillRegenJob(item.job);
      runHillRegenJob(item.job);
    } else {
      await updateHillConjureJob(item.job);
      runHillConjureJob(item.job);
    }
  }
  if (pending.length > 0) {
    console.log(`[asset-library] resumed ${pending.length} queued Hill gpu job(s)`);
  }
}

async function handle(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  const parts = url.pathname.split('/').filter(Boolean);

  try {
    if (url.pathname === '/api/health' && req.method === 'GET') {
      await mkdir(MODELS_DIR, { recursive: true });
      return json(res, 200, { success: true, dataDir: DATA_DIR });
    }

    if (url.pathname === '/api/hill/file' && (req.method === 'GET' || req.method === 'HEAD')) {
      return sendLocalHillFile(res, url.searchParams.get('path'), { head: req.method === 'HEAD' });
    }

    if (url.pathname === '/api/hill/status' && req.method === 'GET') {
      const records = await listModelRecords();
      const jobs = await listHillRegenJobs();
      const conjureJobs = await listHillConjureJobs();
      const promotionQueue = await readPromotionQueue();
      const packs = Array.from(new Set(
        records
          .filter((record) => record?.metadata?.isProductPack === true)
          .map((record) => record.packSlug)
          .filter(Boolean),
      )).sort();
      return json(res, 200, {
        success: true,
        data: {
          dataDir: DATA_DIR,
          jobsDir: HILL_REGEN_JOBS_DIR,
          catalogRoot: '/tank/3d-catalog/assetforge-props',
          modelCount: records.length,
          packCount: packs.length,
          packs,
          promotionQueueCount: promotionQueue.length,
          promotionQueuePath: HILL_PROMOTION_QUEUE_CSV,
          pendingRegenJobs: jobs.filter((job) => job.status === 'queued' || job.status === 'running').length,
          pendingConjureJobs: conjureJobs.filter((job) => job.status === 'queued' || job.status === 'running').length,
        },
      });
    }

    if (url.pathname === '/api/hill/promotion-queue' && req.method === 'GET') {
      const rows = await readPromotionQueue();
      return json(res, 200, { success: true, data: rows });
    }

    if (url.pathname === '/api/hill/promotion-queue/promote' && req.method === 'POST') {
      const body = await readBody(req);
      const slugs = Array.isArray(body?.slugs)
        ? body.slugs.map(String).map((slug) => slug.trim()).filter(Boolean)
        : [];
      if (slugs.length === 0) return error(res, 400, 'Provide one or more slugs to promote');
      const result = await runHillPromoteAsset(slugs, { importVrm: body?.importVrm !== false });
      const records = await listModelRecords();
      const importedModels = records
        .filter((record) => slugs.includes(record.packSlug))
        .map((record) => toIsoRecord(stripListPayload(record)));
      return json(res, 202, { success: true, data: { ...result, importedModels } });
    }

    if (url.pathname === '/api/hill/regen-jobs' && req.method === 'GET') {
      const jobs = await listHillRegenJobs();
      return json(res, 200, { success: true, data: jobs });
    }

    if (url.pathname === '/api/hill/regen-jobs' && req.method === 'POST') {
      const body = await readBody(req);
      const job = await createHillRegenJob(body);
      return json(res, 201, { success: true, data: job });
    }

    if (url.pathname === '/api/hill/conjure-jobs' && req.method === 'GET') {
      const jobs = await listHillConjureJobs();
      return json(res, 200, { success: true, data: jobs });
    }

    if (url.pathname === '/api/hill/conjure-jobs' && req.method === 'POST') {
      const body = await readBody(req);
      const job = await createHillConjureJob(body);
      return json(res, 202, { success: true, data: job });
    }

    if (url.pathname === '/api/hill/export-jobs' && req.method === 'GET') {
      const jobs = await listHillExportJobs();
      return json(res, 200, { success: true, data: jobs });
    }

    if (url.pathname === '/api/hill/export-jobs' && req.method === 'POST') {
      const body = await readBody(req);
      const job = await createHillExportJob(body);
      return json(res, 202, { success: true, data: job });
    }

    if (url.pathname === '/api/hill/enrich-model' && req.method === 'POST') {
      const body = await readBody(req);
      const result = await enrichModelRecord(body);
      return json(res, 200, { success: true, data: result });
    }

    if (url.pathname === '/api/models' && req.method === 'GET') {
      const result = url.searchParams.has('limit')
        ? await queryPagedFileBackedModelRecords(url.searchParams)
        : queryModelRecords(await listModelRecords(), url.searchParams);
      return json(res, 200, {
        success: true,
        data: result.records.map((record) => toIsoRecord(stripListPayload(record))),
        meta: result.meta,
      });
    }

    if (url.pathname === '/api/models' && req.method === 'POST') {
      const body = await readBody(req);
      const { record, wasDeduped } = await saveModel(body, { skipDedup: body.skipDedup === true });
      return json(res, wasDeduped ? 200 : 201, {
        success: true,
        data: toIsoRecord(record),
        wasDeduped,
      });
    }

    if (parts[0] === 'api' && parts[1] === 'models' && parts[2]) {
      const uuid = decodeURIComponent(parts[2]);

      if (parts.length === 3 && req.method === 'GET') {
        const record = await getModelRecord(uuid);
        if (!record) return error(res, 404, `Model ${uuid} not found`);
        const filePath = record.sourcePath && await fileExists(record.sourcePath)
          ? record.sourcePath
          : modelBinaryPath(uuid, record.format);
        const file = await readFile(filePath);
        return json(res, 200, {
          success: true,
          data: {
            ...toIsoRecord(record),
            dataBase64: file.toString('base64'),
          },
        });
      }

      if (parts.length === 4 && parts[3] === 'file' && (req.method === 'GET' || req.method === 'HEAD')) {
        return sendModelFile(res, uuid, { head: req.method === 'HEAD' });
      }

      if (parts.length === 4 && parts[3] === 'thumbnail' && (req.method === 'GET' || req.method === 'HEAD')) {
        return sendModelThumbnail(res, uuid, { head: req.method === 'HEAD' });
      }

      if (parts.length === 3 && req.method === 'PUT') {
        const body = await readBody(req);
        const record = await updateModel(uuid, body);
        if (!record) return error(res, 404, `Model ${uuid} not found`);
        return json(res, 200, { success: true, data: toIsoRecord(record) });
      }

      if (parts.length === 3 && req.method === 'DELETE') {
        const result = await deleteModelRecordAndOwnedAssets(uuid);
        return json(res, 200, { success: true, data: result });
      }
    }

    if (url.pathname === '/api/models:bulk-delete' && req.method === 'POST') {
      const body = await readBody(req);
      const uuids = Array.isArray(body.uuids) ? body.uuids : [];
      const deleted = [];
      for (const uuid of uuids) {
        deleted.push(await deleteModelRecordAndOwnedAssets(uuid));
      }
      return json(res, 200, { success: true, data: { deleted } });
    }

    if (url.pathname === '/api/models:clear' && req.method === 'POST') {
      await rm(MODELS_DIR, { recursive: true, force: true });
      await mkdir(MODELS_DIR, { recursive: true });
      return json(res, 200, { success: true });
    }

    if (url.pathname === '/api/statistics' && req.method === 'GET') {
      const records = await listModelRecords();
      const formats = {};
      const categories = {};
      let totalSize = 0;

      for (const record of records) {
        totalSize += record.size ?? 0;
        formats[record.format] = (formats[record.format] ?? 0) + 1;
        if (record.category) categories[record.category] = (categories[record.category] ?? 0) + 1;
      }

      return json(res, 200, {
        totalAnimations: 0,
        totalModels: records.length,
        totalSize,
        oldestRecord: records.at(-1)?.createdAt,
        newestRecord: records[0]?.createdAt,
        formats,
        categories,
      });
    }

    if (!url.pathname.startsWith('/api/') && await sendStaticFile(req, res, url.pathname)) {
      return;
    }

    error(res, 404, `No route for ${req.method} ${url.pathname}`);
  } catch (err) {
    console.error('[asset-library] request failed:', err);
    error(res, 500, err instanceof Error ? err.message : 'Unexpected server error');
  }
}

await mkdir(MODELS_DIR, { recursive: true });
await resumeQueuedHillJobs();

const server = createServer(handle);

server.listen(PORT, HOST, () => {
  console.log(`[asset-library] listening on http://${HOST}:${PORT}`);
  console.log(`[asset-library] data dir: ${DATA_DIR}`);
  if (STATIC_DIR) console.log(`[asset-library] static dir: ${STATIC_DIR}`);
});
