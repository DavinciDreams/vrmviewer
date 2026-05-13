#!/usr/bin/env node
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const HOST = process.env.ASSET_LIBRARY_HOST ?? '127.0.0.1';
const PORT = Number(process.env.ASSET_LIBRARY_PORT ?? 3100);
const DATA_DIR = path.resolve(process.env.ASSET_LIBRARY_DATA_DIR ?? './data/asset-library');
const MAX_BODY_BYTES = Number(process.env.ASSET_LIBRARY_MAX_BODY_MB ?? 512) * 1024 * 1024;

const MODELS_DIR = path.join(DATA_DIR, 'models');
const ALLOWED_FORMATS = new Set(['vrm', 'gltf', 'glb', 'fbx']);

function json(res, statusCode, value) {
  const body = JSON.stringify(value);
  res.writeHead(statusCode, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
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

async function listModelRecords() {
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

async function findBySha256(sha256) {
  if (!sha256) return null;
  const records = await listModelRecords();
  return records.find((record) => record.sha256 === sha256) ?? null;
}

async function getModelRecord(uuid) {
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
  await writeJson(modelMetadataPath(record.uuid), record);

  return { record, wasDeduped: false };
}

async function updateModel(uuid, updates) {
  const existing = await getModelRecord(uuid);
  if (!existing) return null;

  const record = buildModelRecord(
    {
      ...existing,
      ...updates,
      uuid,
      format: updates.format ?? existing.format,
      size: updates.size ?? existing.size,
    },
    existing,
  );

  await writeJson(modelMetadataPath(uuid), record);
  return record;
}

async function sendModelFile(res, uuid) {
  const record = await getModelRecord(uuid);
  if (!record) return error(res, 404, `Model ${uuid} not found`);

  const filePath = modelBinaryPath(uuid, record.format);
  try {
    const info = await stat(filePath);
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': record.format === 'gltf' ? 'model/gltf+json' : 'model/gltf-binary',
      'Content-Length': info.size,
      'Content-Disposition': `attachment; filename="${record.name}.${record.format}"`,
    });
    res.end(await readFile(filePath));
  } catch {
    error(res, 404, `Model file for ${uuid} not found`);
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

    if (url.pathname === '/api/models' && req.method === 'GET') {
      const records = await listModelRecords();
      return json(res, 200, { success: true, data: records.map((record) => toIsoRecord(stripData(record))) });
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
      const uuid = parts[2];

      if (parts.length === 3 && req.method === 'GET') {
        const record = await getModelRecord(uuid);
        if (!record) return error(res, 404, `Model ${uuid} not found`);
        const file = await readFile(modelBinaryPath(uuid, record.format));
        return json(res, 200, {
          success: true,
          data: {
            ...toIsoRecord(record),
            dataBase64: file.toString('base64'),
          },
        });
      }

      if (parts.length === 4 && parts[3] === 'file' && req.method === 'GET') {
        return sendModelFile(res, uuid);
      }

      if (parts.length === 3 && req.method === 'PUT') {
        const body = await readBody(req);
        const record = await updateModel(uuid, body);
        if (!record) return error(res, 404, `Model ${uuid} not found`);
        return json(res, 200, { success: true, data: toIsoRecord(record) });
      }

      if (parts.length === 3 && req.method === 'DELETE') {
        await rm(modelDir(uuid), { recursive: true, force: true });
        return json(res, 200, { success: true });
      }
    }

    if (url.pathname === '/api/models:bulk-delete' && req.method === 'POST') {
      const body = await readBody(req);
      const uuids = Array.isArray(body.uuids) ? body.uuids : [];
      await Promise.all(uuids.map((uuid) => rm(modelDir(uuid), { recursive: true, force: true })));
      return json(res, 200, { success: true });
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

    error(res, 404, `No route for ${req.method} ${url.pathname}`);
  } catch (err) {
    console.error('[asset-library] request failed:', err);
    error(res, 500, err instanceof Error ? err.message : 'Unexpected server error');
  }
}

await mkdir(MODELS_DIR, { recursive: true });

createServer(handle).listen(PORT, HOST, () => {
  console.log(`[asset-library] listening on http://${HOST}:${PORT}`);
  console.log(`[asset-library] data dir: ${DATA_DIR}`);
});
