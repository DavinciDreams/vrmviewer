/**
 * Backfill — version-gated re-extraction loop.
 *
 * Drives `runBackfillIfNeeded` against a fake-indexeddb-backed Dexie with the
 * three heavy collaborators mocked: VRMLoader, LoaderManager, and the
 * `extractAllMetadata` pipeline entry point. Each scenario seeds records via
 * the real repository and asserts the resulting state + counters.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { ExtractedBundle } from '../database/services/ModelService';
import type { ExtractedModelMetadata } from '../../types/database.types';
import { EXTRACTOR_VERSION } from './constants';

// ---------------------------------------------------------------------------
// Module mocks — hoisted so they're installed before backfill.ts loads.
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => ({
  vrmLoad: vi.fn(),
  loaderLoad: vi.fn(),
  extract: vi.fn(),
}));

vi.mock('../three/loaders/VRMLoader', () => ({
  vrmLoader: { loadFromArrayBuffer: mocks.vrmLoad },
}));
vi.mock('../three/loaders/LoaderManager', () => ({
  loaderManager: { loadFromArrayBuffer: mocks.loaderLoad },
}));
vi.mock('./MetadataPipeline', () => ({
  extractAllMetadata: mocks.extract,
}));

// Import after mocks are registered.
import { runBackfillIfNeeded } from './backfill';
import { getModelRepository } from '../database/repositories/ModelRepository';
import { getDatabase } from '../database/schemas/databaseSchema';
import type { ModelRecord } from '../../types/database.types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const BACKFILL_KEY = 'vrm_backfill_version';

function makeMetadata(
  version: string,
  overrides: Partial<ExtractedModelMetadata> = {},
): ExtractedModelMetadata {
  return {
    schemaVersion: 1,
    extractedAt: new Date(),
    extractorVersion: version,
    geometry: {
      triangleCount: 1000,
      vertexCount: 500,
      meshCount: 1,
      boundingBox: { min: [0, 0, 0], max: [1, 1, 1] },
      height: 1.6,
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
      materialCount: 1,
      textureCount: 0,
      totalTextureBytes: 0,
      materialTypes: { mtoon: 0, pbr: 1, basic: 0, other: 0 },
      hasTransparency: false,
      largestTextureResolution: [0, 0],
    },
    hashes: { sha256: 'old-hash' },
    sourceFormat: {
      format: 'vrm',
      version: '1.0',
      hasAnimations: false,
      animationCount: 0,
    },
    ...overrides,
  };
}

function makeBundle(): ExtractedBundle {
  return {
    sha256: 'new-hash-from-extraction',
    searchTokens: ['fresh', 'tokens'],
    normalizedLicense: { licenseName: 'CC_BY', commercialUsage: 'Allow' },
    extractedMetadata: makeMetadata(EXTRACTOR_VERSION, {
      geometry: {
        triangleCount: 12_000,
        vertexCount: 6_000,
        meshCount: 4,
        boundingBox: { min: [0, 0, 0], max: [1, 1, 1] },
        height: 1.6,
        polyBucket: 'mid',
      },
      rig: {
        boneCount: 55,
        isHumanoid: true,
        humanoidBonesPresent: ['hips', 'spine', 'head'],
        humanoidCompleteness: 1,
        expressionCount: 0,
        expressionPresets: [],
        customExpressions: [],
        blendShapeCount: 0,
      },
    }),
  };
}

async function seed(
  fields: Partial<Pick<ModelRecord, 'name' | 'format' | 'extractedMetadata' | 'data'>> = {},
): Promise<ModelRecord> {
  const repo = getModelRepository();
  const result = await repo.create({
    name: fields.name ?? 'Seed',
    displayName: fields.name ?? 'Seed',
    description: '',
    category: 'character',
    tags: [],
    format: fields.format ?? 'vrm',
    version: '1.0',
    data: fields.data ?? new ArrayBuffer(8),
    size: 8,
    extractedMetadata: fields.extractedMetadata,
  });
  if (!result.success || !result.data) {
    throw new Error('seed failed');
  }
  return result.data;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('runBackfillIfNeeded', () => {
  beforeEach(async () => {
    await getDatabase().models.clear();
    localStorage.clear();
    mocks.vrmLoad.mockReset();
    mocks.loaderLoad.mockReset();
    mocks.extract.mockReset();

    // Defaults: loaders + extractor all succeed.
    mocks.vrmLoad.mockResolvedValue({
      success: true,
      data: { scene: {}, vrm: {} },
    });
    mocks.loaderLoad.mockResolvedValue({
      success: true,
      data: { model: {} },
    });
    mocks.extract.mockResolvedValue(makeBundle());
  });

  afterEach(async () => {
    await getDatabase().models.clear();
    localStorage.clear();
  });

  // -------------------------------------------------------------------------
  // short-circuit
  // -------------------------------------------------------------------------

  describe('short-circuit', () => {
    it('returns 0s immediately when localStorage version === EXTRACTOR_VERSION', async () => {
      await seed({ name: 'Stale', extractedMetadata: makeMetadata('0.0.1') });
      localStorage.setItem(BACKFILL_KEY, EXTRACTOR_VERSION);

      const result = await runBackfillIfNeeded();
      expect(result).toEqual({ processed: 0, updated: 0, failed: 0 });
      // Loader should never have been called.
      expect(mocks.vrmLoad).not.toHaveBeenCalled();
      expect(mocks.extract).not.toHaveBeenCalled();
    });

    it('marks complete + returns 0s when there are no candidates', async () => {
      // Record already on current version — not a candidate.
      await seed({ extractedMetadata: makeMetadata(EXTRACTOR_VERSION) });

      const result = await runBackfillIfNeeded();
      expect(result).toEqual({ processed: 0, updated: 0, failed: 0 });
      expect(localStorage.getItem(BACKFILL_KEY)).toBe(EXTRACTOR_VERSION);
    });

    it('marks complete after a successful run — second invocation short-circuits', async () => {
      await seed({ name: 'A', extractedMetadata: makeMetadata('0.0.1') });

      const first = await runBackfillIfNeeded();
      expect(first.processed).toBe(1);
      expect(first.updated).toBe(1);
      expect(localStorage.getItem(BACKFILL_KEY)).toBe(EXTRACTOR_VERSION);

      // Reset call counts; second call should hit the short-circuit branch.
      mocks.vrmLoad.mockClear();
      mocks.extract.mockClear();

      const second = await runBackfillIfNeeded();
      expect(second).toEqual({ processed: 0, updated: 0, failed: 0 });
      expect(mocks.vrmLoad).not.toHaveBeenCalled();
      expect(mocks.extract).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // candidate detection
  // -------------------------------------------------------------------------

  describe('candidate detection', () => {
    it('treats records with no extractedMetadata as candidates', async () => {
      await seed({ name: 'Pre-Pipeline' /* no extractedMetadata */ });

      const result = await runBackfillIfNeeded();
      expect(result.processed).toBe(1);
      expect(result.updated).toBe(1);
      expect(mocks.extract).toHaveBeenCalledTimes(1);
    });

    it('treats records with stale extractorVersion as candidates', async () => {
      await seed({ extractedMetadata: makeMetadata('0.0.1') });

      const result = await runBackfillIfNeeded();
      expect(result.processed).toBe(1);
      expect(result.updated).toBe(1);
    });

    it('skips records already on the current EXTRACTOR_VERSION', async () => {
      await seed({
        name: 'Current',
        extractedMetadata: makeMetadata(EXTRACTOR_VERSION),
      });
      await seed({
        name: 'Stale',
        extractedMetadata: makeMetadata('0.0.1'),
      });

      const result = await runBackfillIfNeeded();
      expect(result.processed).toBe(1);
      expect(result.updated).toBe(1);
      expect(mocks.extract).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // loader dispatch
  // -------------------------------------------------------------------------

  describe('loader dispatch', () => {
    it('uses vrmLoader for .vrm format records', async () => {
      await seed({ format: 'vrm' });
      await runBackfillIfNeeded();

      expect(mocks.vrmLoad).toHaveBeenCalledTimes(1);
      expect(mocks.loaderLoad).not.toHaveBeenCalled();
    });

    it('uses loaderManager for non-vrm format records (glb)', async () => {
      await seed({ format: 'glb' });
      await runBackfillIfNeeded();

      expect(mocks.loaderLoad).toHaveBeenCalledTimes(1);
      expect(mocks.vrmLoad).not.toHaveBeenCalled();
      // filename derives from format. Note: `expect.any(ArrayBuffer)` is
      // unreliable through fake-indexeddb's structured clone.
      const [buf, name] = mocks.loaderLoad.mock.calls[0];
      expect(typeof (buf as ArrayBuffer).byteLength).toBe('number');
      expect(name).toBe('model.glb');
    });

    it('uses loaderManager for fbx + gltf as well', async () => {
      await seed({ name: 'fbx-model', format: 'fbx' });
      await seed({ name: 'gltf-model', format: 'gltf' });

      await runBackfillIfNeeded();
      expect(mocks.loaderLoad).toHaveBeenCalledTimes(2);
      const filenames = mocks.loaderLoad.mock.calls.map((c) => c[1]).sort();
      expect(filenames).toEqual(['model.fbx', 'model.gltf']);
    });
  });

  // -------------------------------------------------------------------------
  // failure handling
  // -------------------------------------------------------------------------

  describe('failure handling', () => {
    it('counts records with empty data buffer as failed (cannot re-parse)', async () => {
      await seed({ data: new ArrayBuffer(0) });

      const result = await runBackfillIfNeeded();
      expect(result.processed).toBe(1);
      expect(result.updated).toBe(0);
      expect(result.failed).toBe(1);
      // Loader should NOT have been called — we bail on empty data first.
      expect(mocks.vrmLoad).not.toHaveBeenCalled();
    });

    it('counts vrmLoader failure as a failed record', async () => {
      mocks.vrmLoad.mockResolvedValueOnce({ success: false });
      await seed();

      const result = await runBackfillIfNeeded();
      expect(result.processed).toBe(1);
      expect(result.updated).toBe(0);
      expect(result.failed).toBe(1);
    });

    it('counts loaderManager failure as a failed record', async () => {
      mocks.loaderLoad.mockResolvedValueOnce({
        success: true,
        data: { model: null },
      });
      await seed({ format: 'glb' });

      const result = await runBackfillIfNeeded();
      expect(result.failed).toBe(1);
      expect(result.updated).toBe(0);
    });

    it('counts loader throw as a failed record (caught + warned)', async () => {
      mocks.vrmLoad.mockRejectedValueOnce(new Error('parse crashed'));
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      await seed();

      const result = await runBackfillIfNeeded();
      expect(result.failed).toBe(1);
      expect(result.updated).toBe(0);
      warn.mockRestore();
    });

    it('counts extractAllMetadata throw as a failed record', async () => {
      mocks.extract.mockRejectedValueOnce(new Error('extract crashed'));
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      await seed();

      const result = await runBackfillIfNeeded();
      expect(result.failed).toBe(1);
      expect(result.updated).toBe(0);
      warn.mockRestore();
    });

    it('marks complete EVEN WITH failures (prevents infinite retry on corrupt blobs)', async () => {
      await seed({ data: new ArrayBuffer(0) });
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await runBackfillIfNeeded();
      expect(localStorage.getItem(BACKFILL_KEY)).toBe(EXTRACTOR_VERSION);
      warn.mockRestore();
    });
  });

  // -------------------------------------------------------------------------
  // record update + bundle merge
  // -------------------------------------------------------------------------

  describe('record update', () => {
    it('writes extracted bundle fields back onto the record', async () => {
      const seeded = await seed({
        name: 'PreExtract',
        extractedMetadata: makeMetadata('0.0.1'),
      });

      await runBackfillIfNeeded();

      const repo = getModelRepository();
      const refreshed = (await repo.getByUuid(seeded.uuid)).data!;
      expect(refreshed.sha256).toBe('new-hash-from-extraction');
      expect(refreshed.searchTokens).toEqual(['fresh', 'tokens']);
      expect(refreshed.polyBucket).toBe('mid');
      expect(refreshed.isHumanoid).toBe(true);
      expect(refreshed.humanoidBones).toEqual(['hips', 'spine', 'head']);
      expect(refreshed.extractedMetadata?.extractorVersion).toBe(EXTRACTOR_VERSION);
      expect(refreshed.normalizedLicense?.licenseName).toBe('CC_BY');
      // License promoted from normalizedLicense.licenseName.
      expect(refreshed.license).toBe('CC_BY');
    });

    it('does not promote license when normalizedLicense has no licenseName', async () => {
      mocks.extract.mockResolvedValueOnce({
        ...makeBundle(),
        normalizedLicense: { commercialUsage: 'Allow' /* no licenseName */ },
      });
      const seeded = await seed({
        name: 'NoLicenseName',
        extractedMetadata: makeMetadata('0.0.1'),
      });

      await runBackfillIfNeeded();
      const refreshed = (await getModelRepository().getByUuid(seeded.uuid))
        .data!;
      // license was not set before and is not overwritten with undefined.
      expect(refreshed.license).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // progress reporting + batching
  // -------------------------------------------------------------------------

  describe('progress reporting', () => {
    it('calls onProgress at the end of every batch', async () => {
      // BATCH_SIZE = 2 — 3 records ⇒ two ticks (after 2, after 3-capped-to-3).
      await seed({ name: 'A', extractedMetadata: makeMetadata('0.0.1') });
      await seed({ name: 'B', extractedMetadata: makeMetadata('0.0.1') });
      await seed({ name: 'C', extractedMetadata: makeMetadata('0.0.1') });

      const ticks: { processed: number; total: number }[] = [];
      const result = await runBackfillIfNeeded((p) =>
        ticks.push({ processed: p.processed, total: p.total }),
      );

      expect(result.processed).toBe(3);
      expect(result.updated).toBe(3);
      expect(ticks.length).toBeGreaterThanOrEqual(2);
      expect(ticks[ticks.length - 1]).toEqual({ processed: 3, total: 3 });
      expect(ticks[0].total).toBe(3);
    });

    it('processes every candidate even across multiple batches', async () => {
      const seeded: ModelRecord[] = [];
      for (let i = 0; i < 5; i++) {
        seeded.push(
          await seed({
            name: `M-${i}`,
            extractedMetadata: makeMetadata('0.0.1'),
          }),
        );
      }

      const result = await runBackfillIfNeeded();
      expect(result.processed).toBe(5);
      expect(result.updated).toBe(5);
      expect(mocks.extract).toHaveBeenCalledTimes(5);
    });
  });
});
