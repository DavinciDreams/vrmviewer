/**
 * ModelService — sha256 dedup + promoted-field merge.
 *
 * These behaviours were added in PR #28 and not previously covered. The
 * existing `ModelService.test.ts` is a smoke-test file (init + saveModel
 * returns a result) and intentionally leaves the dedup branch untested.
 *
 * Tests run against the real fake-indexeddb-backed Dexie singleton; the
 * `thumbnails` table is also real-IDB so the thumbnail side-effect on the
 * dedup-miss path is exercised end-to-end.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ModelService, type ExtractedBundle } from './ModelService';
import { getDatabase } from '../schemas/databaseSchema';
import type {
  ExtractedModelMetadata,
  ModelRecord,
  NormalizedLicense,
} from '../../../types/database.types';

type ModelInsert = Omit<ModelRecord, 'id' | 'uuid' | 'createdAt' | 'updatedAt'>;

function makeBaseInsert(overrides: Partial<ModelInsert> = {}): ModelInsert {
  return {
    name: 'TestModel',
    displayName: 'Test Model',
    description: 'fixture',
    category: 'character',
    tags: [],
    format: 'vrm',
    version: '1.0',
    data: new ArrayBuffer(8),
    size: 8,
    ...overrides,
  };
}

function makeExtractedMetadata(
  overrides: Partial<ExtractedModelMetadata> = {},
): ExtractedModelMetadata {
  return {
    schemaVersion: 1,
    extractedAt: new Date(),
    extractorVersion: '1.0.0',
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
      humanoidCompleteness: 0.42,
      expressionCount: 5,
      expressionPresets: ['aa', 'happy'],
      customExpressions: [],
      blendShapeCount: 5,
    },
    materials: {
      materialCount: 3,
      textureCount: 4,
      totalTextureBytes: 1_000_000,
      materialTypes: { mtoon: 2, pbr: 1, basic: 0, other: 0 },
      hasTransparency: false,
      largestTextureResolution: [1024, 1024],
    },
    hashes: {
      sha256: 'deadbeef',
    },
    sourceFormat: {
      format: 'vrm',
      version: '1.0',
      hasAnimations: false,
      animationCount: 0,
    },
    ...overrides,
  };
}

function makeBundle(overrides: {
  sha256?: string;
  normalizedLicense?: Partial<NormalizedLicense>;
  metadata?: Partial<ExtractedModelMetadata>;
  searchTokens?: string[];
} = {}): ExtractedBundle {
  return {
    sha256: overrides.sha256 ?? 'deadbeef',
    searchTokens: overrides.searchTokens ?? ['token-a', 'token-b'],
    normalizedLicense: {
      licenseName: 'CC_BY',
      commercialUsage: 'Allow',
      ...overrides.normalizedLicense,
    },
    extractedMetadata: makeExtractedMetadata(overrides.metadata),
  };
}

describe('ModelService — sha256 dedup + promoted-field merge', () => {
  let service: ModelService;

  beforeEach(async () => {
    const db = getDatabase();
    await db.models.clear();
    await db.thumbnails.clear();
    service = new ModelService();
  });

  afterEach(async () => {
    const db = getDatabase();
    await db.models.clear();
    await db.thumbnails.clear();
  });

  // -------------------------------------------------------------------------
  // dedup
  // -------------------------------------------------------------------------

  describe('dedup', () => {
    it('returns the existing record (wasDeduped=true) when a sha256 match is found', async () => {
      // Seed a record with sha256 = 'shared-hash'.
      const first = await service.saveModel(
        makeBaseInsert({ name: 'First' }),
        undefined,
        makeBundle({ sha256: 'shared-hash' }),
      );
      expect(first.success).toBe(true);
      expect(first.wasDeduped).toBeFalsy();

      // Attempt to save a different file that hashes to the same sha256.
      const second = await service.saveModel(
        makeBaseInsert({ name: 'Second', data: new ArrayBuffer(16) }),
        undefined,
        makeBundle({ sha256: 'shared-hash' }),
      );

      expect(second.success).toBe(true);
      expect(second.wasDeduped).toBe(true);
      expect(second.data!.uuid).toBe(first.data!.uuid);
      // Library should still hold exactly one record.
      expect(await getDatabase().models.count()).toBe(1);
    });

    it('does NOT dedup when skipDedup=true — inserts a new record even with matching sha256', async () => {
      await service.saveModel(
        makeBaseInsert({ name: 'First' }),
        undefined,
        makeBundle({ sha256: 'shared-hash' }),
      );

      const second = await service.saveModel(
        makeBaseInsert({ name: 'SecondAsCopy' }),
        undefined,
        makeBundle({ sha256: 'shared-hash' }),
        /* skipDedup */ true,
      );

      expect(second.success).toBe(true);
      expect(second.wasDeduped).toBeFalsy();
      expect(await getDatabase().models.count()).toBe(2);
    });

    it('does NOT dedup when no extractedBundle is provided (no sha256 to compare)', async () => {
      const first = await service.saveModel(makeBaseInsert({ name: 'First' }));
      const second = await service.saveModel(makeBaseInsert({ name: 'Second' }));

      expect(first.success).toBe(true);
      expect(second.success).toBe(true);
      expect(second.wasDeduped).toBeFalsy();
      expect(await getDatabase().models.count()).toBe(2);
    });

    it('does NOT dedup when extractedBundle has no sha256', async () => {
      const bundle = makeBundle({ sha256: '' });
      const result = await service.saveModel(
        makeBaseInsert({ name: 'EmptyHash' }),
        undefined,
        bundle,
      );
      expect(result.success).toBe(true);
      expect(result.wasDeduped).toBeFalsy();
    });

    it('inserts normally when sha256 does NOT match anything in the library', async () => {
      await service.saveModel(
        makeBaseInsert({ name: 'First' }),
        undefined,
        makeBundle({ sha256: 'first-hash' }),
      );
      const second = await service.saveModel(
        makeBaseInsert({ name: 'Second' }),
        undefined,
        makeBundle({ sha256: 'second-hash' }),
      );

      expect(second.success).toBe(true);
      expect(second.wasDeduped).toBeFalsy();
      expect(await getDatabase().models.count()).toBe(2);
    });
  });

  // -------------------------------------------------------------------------
  // promoted-field merge
  // -------------------------------------------------------------------------

  describe('promoted-field merge', () => {
    it('promotes sha256 / searchTokens / polyBucket / isHumanoid / humanoidBones onto the record', async () => {
      const result = await service.saveModel(
        makeBaseInsert({ name: 'Promoted' }),
        undefined,
        makeBundle({
          sha256: 'hash-promotion',
          searchTokens: ['alpha', 'beta'],
          metadata: {
            geometry: {
              triangleCount: 12_000,
              vertexCount: 6_000,
              meshCount: 4,
              boundingBox: { min: [0, 0, 0], max: [1, 1, 1] },
              height: 1.6,
              polyBucket: 'high',
            },
            rig: {
              boneCount: 55,
              isHumanoid: true,
              humanoidBonesPresent: ['hips', 'spine'],
              humanoidCompleteness: 0.5,
              expressionCount: 0,
              expressionPresets: [],
              customExpressions: [],
              blendShapeCount: 0,
            },
          },
        }),
      );

      expect(result.success).toBe(true);
      const saved = result.data!;
      expect(saved.sha256).toBe('hash-promotion');
      expect(saved.searchTokens).toEqual(['alpha', 'beta']);
      expect(saved.polyBucket).toBe('high');
      expect(saved.isHumanoid).toBe(true);
      expect(saved.humanoidBones).toEqual(['hips', 'spine']);
      expect(saved.extractedMetadata).toBeDefined();
      expect(saved.extractedMetadata?.geometry.polyBucket).toBe('high');
      expect(saved.normalizedLicense?.licenseName).toBe('CC_BY');
    });

    it('falls back license=normalizedLicense.licenseName when caller did not set license', async () => {
      const insert = makeBaseInsert({ name: 'LicenseFallback' });
      // Force-clear license so the fallback path is exercised.
      delete (insert as Partial<ModelInsert>).license;

      const result = await service.saveModel(
        insert,
        undefined,
        makeBundle({
          normalizedLicense: { licenseName: 'CC0' },
        }),
      );

      expect(result.success).toBe(true);
      expect(result.data!.license).toBe('CC0');
    });

    it('does NOT overwrite caller-provided license with normalizedLicense.licenseName', async () => {
      const result = await service.saveModel(
        makeBaseInsert({ name: 'LicenseExplicit', license: 'My-Custom-License' }),
        undefined,
        makeBundle({
          normalizedLicense: { licenseName: 'CC0' },
        }),
      );

      expect(result.success).toBe(true);
      expect(result.data!.license).toBe('My-Custom-License');
    });

    it('saves an associated thumbnail when one is provided', async () => {
      const result = await service.saveModel(
        makeBaseInsert({ name: 'WithThumb' }),
        'data:image/png;base64,iVBORw0KGgo=',
        makeBundle({ sha256: 'thumb-hash' }),
      );

      expect(result.success).toBe(true);
      const thumbs = await getDatabase()
        .thumbnails.where('targetUuid')
        .equals(result.data!.uuid)
        .toArray();
      expect(thumbs).toHaveLength(1);
      expect(thumbs[0].type).toBe('model');
    });

    it('does NOT save a thumbnail when one is not provided', async () => {
      const result = await service.saveModel(
        makeBaseInsert({ name: 'NoThumb' }),
        undefined,
        makeBundle({ sha256: 'no-thumb-hash' }),
      );

      expect(result.success).toBe(true);
      const thumbs = await getDatabase()
        .thumbnails.where('targetUuid')
        .equals(result.data!.uuid)
        .toArray();
      expect(thumbs).toHaveLength(0);
    });
  });
});
