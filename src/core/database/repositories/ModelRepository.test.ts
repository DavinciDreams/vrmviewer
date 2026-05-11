/**
 * ModelRepository Tests — scoped to the additions in this PR
 * (`findBySha256`, `getDistinctValues`, the `ModelRecordSummary` type).
 *
 * fake-indexeddb IS available globally via `src/test/setup.ts`, but these
 * tests spy on the underlying Dexie table methods directly so we can drive
 * specific code paths without seeding state. The query() blob-stripping
 * and server-side v3 facet filters from the original `wip` branch are not
 * part of this PR and have separate test coverage queued for a future
 * follow-up.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ModelRepository, ModelRecordSummary } from './ModelRepository';
import { ModelRecord } from '../../../types/database.types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRecord(overrides: Partial<ModelRecord> = {}): ModelRecord {
  return {
    id: 1,
    uuid: 'test-uuid-1',
    name: 'TestModel',
    displayName: 'Test Model',
    description: 'A test model',
    category: 'character',
    tags: ['anime', 'fantasy'],
    format: 'vrm',
    version: '1.0',
    author: 'Author A',
    license: 'CC_BY_NC',
    data: new ArrayBuffer(8),
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    size: 8,
    searchTokens: ['testmodel', 'test', 'model'],
    polyBucket: 'mid',
    isHumanoid: true,
    humanoidBones: ['hips', 'spine', 'head'],
    sha256: 'abc123sha256',
    normalizedLicense: {
      licenseName: 'CC_BY_NC',
      commercialUsage: 'Disallow',
    },
    ...overrides,
  };
}

function makeTableMock(records: ModelRecord[]) {
  return {
    add: vi.fn().mockResolvedValue(records[0]?.id ?? 1),
    count: vi.fn().mockResolvedValue(records.length),
    where: vi.fn().mockImplementation((field: string) => ({
      equals: vi.fn().mockImplementation((value: unknown) => ({
        first: vi.fn().mockImplementation(() =>
          Promise.resolve(records.find((r) => (r as any)[field] === value)),
        ),
      })),
    })),
    orderBy: vi.fn().mockReturnValue({
      uniqueKeys: vi.fn().mockResolvedValue(
        [...new Set(records.map((r) => r.format))],
      ),
    }),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ModelRepository', () => {
  let repo: ModelRepository;
  let tableMock: ReturnType<typeof makeTableMock>;

  beforeEach(() => {
    repo = new ModelRepository();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('findBySha256()', () => {
    it('returns the record (blob-stripped) when a matching sha256 exists', async () => {
      const record = makeRecord({ sha256: 'deadbeef' });
      tableMock = makeTableMock([record]);
      vi.spyOn(repo['db'], 'models', 'get').mockReturnValue(tableMock as any);

      const result = await repo.findBySha256('deadbeef');
      expect(result.success).toBe(true);
      expect((result.data as ModelRecordSummary).sha256).toBe('deadbeef');
      // The raw ArrayBuffer should be stripped — callers needing the bytes
      // re-fetch via getByUuid.
      expect((result.data as ModelRecordSummary).data).toBeUndefined();
    });

    it('returns NOT_FOUND when no record matches', async () => {
      tableMock = makeTableMock([]);
      vi.spyOn(repo['db'], 'models', 'get').mockReturnValue(tableMock as any);

      const result = await repo.findBySha256('missing');
      expect(result.success).toBe(false);
      expect(result.error?.type).toBe('NOT_FOUND');
    });
  });

  describe('getDistinctValues()', () => {
    it('returns deduped list of formats', async () => {
      const records = [
        makeRecord({ id: 1, format: 'vrm' }),
        makeRecord({ id: 2, format: 'vrm', uuid: 'uuid-2' }),
        makeRecord({ id: 3, format: 'glb', uuid: 'uuid-3' }),
      ];
      tableMock = makeTableMock(records);
      // Override orderBy to return the deduped unique keys directly.
      tableMock.orderBy = vi.fn().mockReturnValue({
        uniqueKeys: vi.fn().mockResolvedValue(['glb', 'vrm']),
      });
      vi.spyOn(repo['db'], 'models', 'get').mockReturnValue(tableMock as any);

      const values = await repo.getDistinctValues('format');
      expect(values).toEqual(['glb', 'vrm']);
      expect(new Set(values).size).toBe(values.length);
    });

    it('returns empty array when table is empty', async () => {
      tableMock = makeTableMock([]);
      tableMock.orderBy = vi.fn().mockReturnValue({
        uniqueKeys: vi.fn().mockResolvedValue([]),
      });
      vi.spyOn(repo['db'], 'models', 'get').mockReturnValue(tableMock as any);

      const values = await repo.getDistinctValues('category');
      expect(values).toEqual([]);
    });

    it('filters out non-string / empty keys', async () => {
      tableMock = makeTableMock([]);
      tableMock.orderBy = vi.fn().mockReturnValue({
        uniqueKeys: vi.fn().mockResolvedValue(['vrm', null, '', undefined, 'glb']),
      });
      vi.spyOn(repo['db'], 'models', 'get').mockReturnValue(tableMock as any);

      const values = await repo.getDistinctValues('format');
      expect(values).toEqual(['vrm', 'glb']);
    });
  });
});
