#!/usr/bin/env node
/**
 * extract-metadata.mjs
 *
 * Usage:
 *   node scripts/extract-metadata.mjs <input-dir> [output-manifest.json]
 *
 * Walks <input-dir> for .vrm, .glb, .gltf, .fbx files, runs the metadata
 * extraction pipeline on each, and outputs a JSON manifest.
 *
 * Exit 0 if at least one file succeeded; exit 1 if all failed.
 *
 * This script runs in Node ESM. It imports Three.js loaders directly and
 * guards GPU-heavy @pixiv/three-vrm imports with try/catch.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// Resolve project root so we can import project source modules.
// ---------------------------------------------------------------------------
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// Supported extensions
// ---------------------------------------------------------------------------
const SUPPORTED_EXTENSIONS = new Set(['.vrm', '.glb', '.gltf', '.fbx']);

// ---------------------------------------------------------------------------
// Polyfill minimal browser globals required by Three.js in Node
// ---------------------------------------------------------------------------
if (typeof globalThis.self === 'undefined') {
  globalThis.self = globalThis;
}
if (typeof globalThis.window === 'undefined') {
  globalThis.window = /** @type {unknown} */ (globalThis);
}

// ---------------------------------------------------------------------------
// Dynamically import Three.js loaders
// ---------------------------------------------------------------------------
let THREE;
let GLTFLoader;
let FBXLoader;
let VRMALoader;

try {
  THREE = (await import('three')).default ?? (await import('three'));
} catch (err) {
  console.error('Failed to import three:', err.message);
  process.exit(1);
}

try {
  const gltfMod = await import('three/examples/jsm/loaders/GLTFLoader.js');
  GLTFLoader = gltfMod.GLTFLoader;
} catch {
  GLTFLoader = null;
  console.warn('[extract-metadata] GLTFLoader unavailable — skipping glb/gltf/vrm.');
}

try {
  const fbxMod = await import('three/examples/jsm/loaders/FBXLoader.js');
  FBXLoader = fbxMod.FBXLoader;
} catch {
  FBXLoader = null;
  console.warn('[extract-metadata] FBXLoader unavailable — skipping fbx.');
}

// MToon / @pixiv/three-vrm has GPU dependencies; guard carefully.
let VRMLoaderPlugin = null;
try {
  const vrmMod = await import('@pixiv/three-vrm');
  VRMLoaderPlugin = vrmMod.VRMLoaderPlugin ?? null;
} catch {
  console.warn('[extract-metadata] @pixiv/three-vrm not available — VRM metadata will degrade.');
}

// ---------------------------------------------------------------------------
// Attempt to import the project's metadata pipeline.
// This will only work when running after a build; in dev we stub it.
// ---------------------------------------------------------------------------
let extractAllMetadata = null;
try {
  // Try the compiled output path first (post-build).
  const pipeMod = await import(
    path.join(projectRoot, 'dist/core/metadata/MetadataPipeline.js')
  );
  extractAllMetadata = pipeMod.extractAllMetadata ?? null;
} catch {
  // Pre-build: import directly from source (ts-node / tsx not available here,
  // so we fall back to a minimal inline extractor stub).
  console.warn(
    '[extract-metadata] MetadataPipeline not found in dist — using stub extractor.'
  );
}

// ---------------------------------------------------------------------------
// Minimal stub extractor used when the pipeline module is unavailable.
// ---------------------------------------------------------------------------
async function stubExtractAllMetadata(parsed, arrayBuffer) {
  const sha256 = await computeSha256(arrayBuffer);
  return {
    extractedMetadata: {
      schemaVersion: 1,
      extractedAt: new Date(),
      extractorVersion: 'stub-1.0.0',
      geometry: {
        triangleCount: 0,
        vertexCount: 0,
        meshCount: 0,
        boundingBox: { min: [0, 0, 0], max: [0, 0, 0] },
        height: 0,
        polyBucket: 'low',
      },
      rig: {
        boneCount: 0,
        isHumanoid: false,
        humanoidBonesPresent: [],
        humanoidCompleteness: 0,
        expressionCount: 0,
        expressionPresets: [],
        customExpressions: [],
        blendShapeCount: 0,
      },
      materials: {
        materialCount: 0,
        textureCount: 0,
        totalTextureBytes: 0,
        materialTypes: { mtoon: 0, pbr: 0, basic: 0, other: 0 },
        hasTransparency: false,
        largestTextureResolution: [0, 0],
      },
      hashes: { sha256 },
      sourceFormat: { format: 'unknown', version: 'unknown', hasAnimations: false, animationCount: 0 },
    },
    normalizedLicense: {},
    searchTokens: [],
    sha256,
  };
}

// ---------------------------------------------------------------------------
// SHA-256 helper (Node crypto)
// ---------------------------------------------------------------------------
async function computeSha256(arrayBuffer) {
  const { createHash } = await import('node:crypto');
  const hash = createHash('sha256');
  hash.update(Buffer.from(arrayBuffer));
  return hash.digest('hex');
}

// ---------------------------------------------------------------------------
// Parse a file using Three.js loaders
// ---------------------------------------------------------------------------
async function parseFile(filePath, arrayBuffer) {
  const ext = path.extname(filePath).toLowerCase();

  if ((ext === '.vrm' || ext === '.glb' || ext === '.gltf') && GLTFLoader) {
    return new Promise((resolve, reject) => {
      // Three.js GLTFLoader expects a LoadingManager-compatible environment.
      // In Node, we provide the ArrayBuffer directly.
      const loader = new GLTFLoader();

      // Attach VRM plugin if available.
      if (VRMLoaderPlugin && (ext === '.vrm')) {
        try {
          loader.register((parser) => new VRMLoaderPlugin(parser));
        } catch {
          // Plugin attach failed — proceed without VRM-specific parsing.
        }
      }

      // GLTFLoader.parse accepts (data, path, onLoad, onError)
      loader.parse(
        arrayBuffer,
        '',
        (gltf) => resolve(gltf),
        (err) => reject(err)
      );
    });
  }

  if (ext === '.fbx' && FBXLoader) {
    return new Promise((resolve, reject) => {
      const loader = new FBXLoader();
      try {
        // FBXLoader.parse is synchronous in most versions.
        const scene = loader.parse(arrayBuffer, '');
        resolve(scene);
      } catch (err) {
        reject(err);
      }
    });
  }

  throw new Error(`No loader available for extension "${ext}"`);
}

// ---------------------------------------------------------------------------
// Walk directory recursively for supported model files
// ---------------------------------------------------------------------------
async function walkDir(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkDir(full)));
    } else if (SUPPORTED_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      files.push(full);
    }
  }
  return files;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const [, , inputDir, outputPath] = process.argv;

  if (!inputDir) {
    console.error('Usage: node scripts/extract-metadata.mjs <input-dir> [output-manifest.json]');
    process.exit(1);
  }

  let resolvedDir;
  try {
    resolvedDir = path.resolve(inputDir);
    await fs.access(resolvedDir);
  } catch {
    console.error(`Input directory not found: ${inputDir}`);
    process.exit(1);
  }

  const files = await walkDir(resolvedDir);
  if (files.length === 0) {
    console.error('No supported model files found in directory.');
    process.exit(1);
  }

  const extract = extractAllMetadata ?? stubExtractAllMetadata;
  const manifest = [];
  let successCount = 0;

  for (let i = 0; i < files.length; i++) {
    const filePath = files[i];
    const relPath = path.relative(resolvedDir, filePath);
    process.stderr.write(`[${i + 1}/${files.length}] processing ${relPath}\n`);

    let entry;
    try {
      const buffer = await fs.readFile(filePath);
      const arrayBuffer = buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength
      );

      let parsed = null;
      try {
        parsed = await parseFile(filePath, arrayBuffer);
      } catch (parseErr) {
        console.warn(`  Parse failed for ${relPath}: ${parseErr.message}`);
      }

      const result = await extract(parsed, arrayBuffer);
      const sha256 = result.sha256 ?? (await computeSha256(arrayBuffer));

      entry = {
        file: relPath,
        sha256,
        extractedMetadata: result.extractedMetadata,
        normalizedLicense: result.normalizedLicense,
        searchTokens: result.searchTokens,
      };
      successCount++;
    } catch (err) {
      entry = { file: relPath, sha256: null, error: err.message };
      console.warn(`  Failed: ${relPath} — ${err.message}`);
    }

    manifest.push(entry);
  }

  const manifestJson = JSON.stringify(manifest, null, 2);

  if (outputPath) {
    await fs.writeFile(path.resolve(outputPath), manifestJson, 'utf8');
    console.error(`Manifest written to ${outputPath}`);
  } else {
    process.stdout.write(manifestJson + '\n');
  }

  process.exit(successCount > 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
