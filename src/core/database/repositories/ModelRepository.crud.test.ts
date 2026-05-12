/**
 * ModelRepository — full CRUD + query() facet + getAllSummaries() coverage.
 *
 * Complements the spy-based `ModelRepository.test.ts` (which is scoped to
 * `findBySha256` / `getDistinctValues`). This file exercises the repository
 * against a real fake-indexeddb-backed Dexie instance — every test starts
 * with an empty `models` table and seeds via `repo.create()`.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ModelRepository, ModelRecordSummary } from './ModelRepository';
import { getDatabase } from '../schemas/databaseSchema';
import type { ModelRecord, NormalizedLicense } from '../../../types/database.types';

type ModelInsert = Omit<ModelRecord, 'id' | 'uuid' | 'createdAt' | 'updatedAt'>;

function makeInsert(overrides: Partial<ModelInsert> = {}): ModelInsert {
  return {
    name: 'TestModel',
    displayName: 'Test Model',
    description: 'fixture',
    category: 'character',
    tags: ['anime'],
    format: 'vrm',
    version: '1.0',
    author: 'Author A',
    license: 'CC_BY_NC',
    data: new ArrayBuffer(8),
    size: 8,
    ...overrides,
  };
}

function normalizedLicense(
  overrides: Partial<NormalizedLicense> = {},
): NormalizedLicense {
  return {
    licenseName: 'CC_BY',
    commercialUsage: 'Allow',
    ...overrides,
  };
}

describe('ModelRepository (integration)', () => {
  let repo: ModelRepository;

  beforeEach(async () => {
    await getDatabase().models.clear();
    repo = new ModelRepository();
  });

  afterEach(async () => {
    await getDatabase().models.clear();
  });

  // -------------------------------------------------------------------------
  // create + read
  // -------------------------------------------------------------------------

  describe('create()', () => {
    it('inserts a record and returns it with an auto-assigned uuid + timestamps', async () => {
      const before = Date.now();
      const result = await repo.create(makeInsert({ name: 'A' }));
      const after = Date.now();

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.id).toBeTypeOf('number');
      expect(result.data!.uuid).toMatch(/^[0-9a-f-]{36}$/);
      expect(result.data!.name).toBe('A');
      expect(result.data!.createdAt.getTime()).toBeGreaterThanOrEqual(before);
      expect(result.data!.createdAt.getTime()).toBeLessThanOrEqual(after);
      expect(result.data!.updatedAt.getTime()).toBe(result.data!.createdAt.getTime());
    });
  });

  describe('getById() / getByUuid() / getByName()', () => {
    it('getById returns the stored record', async () => {
      const created = (await repo.create(makeInsert())).data!;
      const fetched = await repo.getById(created.id!);
      expect(fetched.success).toBe(true);
      expect(fetched.data!.uuid).toBe(created.uuid);
    });

    it('getById returns NOT_FOUND for unknown id', async () => {
      const fetched = await repo.getById(9999);
      expect(fetched.success).toBe(false);
      expect(fetched.error?.type).toBe('NOT_FOUND');
    });

    it('getByUuid returns the stored record', async () => {
      const created = (await repo.create(makeInsert())).data!;
      const fetched = await repo.getByUuid(created.uuid);
      expect(fetched.success).toBe(true);
      expect(fetched.data!.id).toBe(created.id);
    });

    it('getByUuid returns NOT_FOUND for unknown uuid', async () => {
      const fetched = await repo.getByUuid('does-not-exist');
      expect(fetched.success).toBe(false);
      expect(fetched.error?.type).toBe('NOT_FOUND');
    });

    it('getByName returns every record sharing that name', async () => {
      await repo.create(makeInsert({ name: 'Shared' }));
      await repo.create(makeInsert({ name: 'Shared' }));
      await repo.create(makeInsert({ name: 'Other' }));

      const fetched = await repo.getByName('Shared');
      expect(fetched.success).toBe(true);
      expect(fetched.data).toHaveLength(2);
      expect(fetched.data!.every((m) => m.name === 'Shared')).toBe(true);
    });

    it('getByName returns an empty array (still success) when no record matches', async () => {
      const fetched = await repo.getByName('Nope');
      expect(fetched.success).toBe(true);
      expect(fetched.data).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // update + delete
  // -------------------------------------------------------------------------

  describe('update() / updateByUuid()', () => {
    it('update by id merges fields and bumps updatedAt', async () => {
      const created = (await repo.create(makeInsert({ name: 'Old' }))).data!;
      const originalUpdatedAt = created.updatedAt.getTime();

      // Small delay so updatedAt strictly advances.
      await new Promise((r) => setTimeout(r, 5));

      const updated = await repo.update(created.id!, { name: 'New', size: 99 });
      expect(updated.success).toBe(true);
      expect(updated.data!.name).toBe('New');
      expect(updated.data!.size).toBe(99);
      expect(updated.data!.uuid).toBe(created.uuid);
      expect(updated.data!.updatedAt.getTime()).toBeGreaterThanOrEqual(originalUpdatedAt);
    });

    it('update returns NOT_FOUND for unknown id', async () => {
      const result = await repo.update(9999, { name: 'x' });
      expect(result.success).toBe(false);
      expect(result.error?.type).toBe('NOT_FOUND');
    });

    it('updateByUuid by uuid mutates the matching record', async () => {
      const created = (await repo.create(makeInsert({ tags: ['old'] }))).data!;
      const result = await repo.updateByUuid(created.uuid, { tags: ['new', 'tags'] });
      expect(result.success).toBe(true);
      expect(result.data!.tags).toEqual(['new', 'tags']);
    });

    it('updateByUuid returns NOT_FOUND for unknown uuid', async () => {
      const result = await repo.updateByUuid('nope', { name: 'x' });
      expect(result.success).toBe(false);
      expect(result.error?.type).toBe('NOT_FOUND');
    });
  });

  describe('delete() / deleteByUuid()', () => {
    it('delete removes the record by id', async () => {
      const created = (await repo.create(makeInsert())).data!;
      const result = await repo.delete(created.id!);
      expect(result.success).toBe(true);
      expect((await repo.getById(created.id!)).success).toBe(false);
    });

    it('deleteByUuid removes the record by uuid', async () => {
      const created = (await repo.create(makeInsert())).data!;
      const result = await repo.deleteByUuid(created.uuid);
      expect(result.success).toBe(true);
      expect((await repo.getByUuid(created.uuid)).success).toBe(false);
    });

    it('deleteByUuid returns NOT_FOUND for unknown uuid', async () => {
      const result = await repo.deleteByUuid('does-not-exist');
      expect(result.success).toBe(false);
      expect(result.error?.type).toBe('NOT_FOUND');
    });
  });

  // -------------------------------------------------------------------------
  // getAll + getAllSummaries
  // -------------------------------------------------------------------------

  describe('getAll() / getAllSummaries() / count() / clear()', () => {
    it('getAll returns every record (with blob)', async () => {
      await repo.create(makeInsert({ name: 'A', data: new ArrayBuffer(4) }));
      await repo.create(makeInsert({ name: 'B', data: new ArrayBuffer(16) }));

      const result = await repo.getAll();
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      // Every record keeps its raw bytes — getAll is the un-stripped path.
      // `instanceof ArrayBuffer` is unreliable through fake-indexeddb's
      // structured clone (cross-realm constructor identity), so probe the
      // duck-typed surface instead.
      for (const m of result.data!) {
        expect(m.data).toBeDefined();
        expect(typeof (m.data as ArrayBuffer).byteLength).toBe('number');
      }
    });

    it('getAll returns empty array (still success) when table is empty', async () => {
      const result = await repo.getAll();
      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it('getAllSummaries strips the data blob from every record', async () => {
      await repo.create(makeInsert({ name: 'A', data: new ArrayBuffer(8) }));
      await repo.create(makeInsert({ name: 'B', data: new ArrayBuffer(8) }));

      const result = await repo.getAllSummaries();
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      const summaries = result.data as ModelRecordSummary[];
      for (const s of summaries) {
        expect(s.data).toBeUndefined();
        expect(s.name).toBeDefined();
        expect(s.uuid).toBeDefined();
      }
    });

    it('count() reflects table size', async () => {
      expect(await repo.count()).toBe(0);
      await repo.create(makeInsert());
      await repo.create(makeInsert());
      expect(await repo.count()).toBe(2);
    });

    it('clear() empties the table', async () => {
      await repo.create(makeInsert());
      await repo.create(makeInsert());
      expect(await repo.count()).toBe(2);

      const result = await repo.clear();
      expect(result.success).toBe(true);
      expect(await repo.count()).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // query() — base filters + sort + pagination
  // -------------------------------------------------------------------------

  describe('query() — base filters', () => {
    beforeEach(async () => {
      await repo.create(
        makeInsert({
          name: 'AlphaCharacter',
          displayName: 'Alpha',
          category: 'character',
          format: 'vrm',
          tags: ['anime'],
        }),
      );
      await repo.create(
        makeInsert({
          name: 'BetaProp',
          displayName: 'Beta',
          category: 'prop',
          format: 'glb',
          tags: ['furniture', 'wooden'],
        }),
      );
      await repo.create(
        makeInsert({
          name: 'GammaCharacter',
          displayName: 'Gamma',
          category: 'character',
          format: 'vrm',
          tags: ['fantasy', 'anime'],
        }),
      );
    });

    it('search matches name / displayName / description / tags case-insensitively', async () => {
      const byName = await repo.query({ search: 'alpha' });
      expect(byName.data.map((m) => m.name)).toEqual(['AlphaCharacter']);

      const byTag = await repo.query({ search: 'WOODEN' });
      expect(byTag.data.map((m) => m.name)).toEqual(['BetaProp']);

      const broad = await repo.query({ search: 'anime' });
      expect(broad.data.map((m) => m.name).sort()).toEqual([
        'AlphaCharacter',
        'GammaCharacter',
      ]);
    });

    it('category filter restricts to matches', async () => {
      const result = await repo.query({ category: 'character' });
      expect(result.data).toHaveLength(2);
      expect(result.data.every((m) => m.category === 'character')).toBe(true);
    });

    it('format filter restricts to matches', async () => {
      const result = await repo.query({ format: 'glb' });
      expect(result.data.map((m) => m.name)).toEqual(['BetaProp']);
    });

    it('tags filter is OR-of-tags (any-match)', async () => {
      const result = await repo.query({ tags: ['fantasy', 'furniture'] });
      expect(result.data.map((m) => m.name).sort()).toEqual([
        'BetaProp',
        'GammaCharacter',
      ]);
    });

    it('date range filter is inclusive of bounds', async () => {
      // Past-date filter: matching ALL inserted-just-now records.
      const result = await repo.query({
        startDate: new Date(Date.now() - 60_000),
        endDate: new Date(Date.now() + 60_000),
      });
      expect(result.data).toHaveLength(3);
    });

    it('startDate filter excludes earlier records', async () => {
      const future = new Date(Date.now() + 60_000);
      const result = await repo.query({ startDate: future });
      expect(result.data).toHaveLength(0);
    });

    it('orderBy + orderDirection sort the results', async () => {
      const ascByName = await repo.query({
        orderBy: 'name',
        orderDirection: 'asc',
      });
      expect(ascByName.data.map((m) => m.name)).toEqual([
        'AlphaCharacter',
        'BetaProp',
        'GammaCharacter',
      ]);

      const descByName = await repo.query({
        orderBy: 'name',
        orderDirection: 'desc',
      });
      expect(descByName.data.map((m) => m.name)).toEqual([
        'GammaCharacter',
        'BetaProp',
        'AlphaCharacter',
      ]);
    });

    it('limit + offset paginate and hasMore flips correctly', async () => {
      const page1 = await repo.query({
        orderBy: 'name',
        orderDirection: 'asc',
        limit: 2,
        offset: 0,
      });
      expect(page1.data).toHaveLength(2);
      expect(page1.total).toBe(3);
      expect(page1.hasMore).toBe(true);

      const page2 = await repo.query({
        orderBy: 'name',
        orderDirection: 'asc',
        limit: 2,
        offset: 2,
      });
      expect(page2.data).toHaveLength(1);
      expect(page2.total).toBe(3);
      expect(page2.hasMore).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // query() — extraction-pipeline facet filters (added in #28/#32)
  // -------------------------------------------------------------------------

  describe('query() — extraction-pipeline facets', () => {
    beforeEach(async () => {
      await repo.create(
        makeInsert({
          name: 'HumanoidMid',
          polyBucket: 'mid',
          isHumanoid: true,
          license: 'CC_BY',
          normalizedLicense: normalizedLicense({ commercialUsage: 'Allow' }),
        }),
      );
      await repo.create(
        makeInsert({
          name: 'NonHumanoidLow',
          polyBucket: 'low',
          isHumanoid: false,
          license: 'CC_BY_NC',
          normalizedLicense: normalizedLicense({ commercialUsage: 'Disallow' }),
        }),
      );
      await repo.create(
        makeInsert({
          name: 'HumanoidHigh',
          polyBucket: 'high',
          isHumanoid: true,
          license: 'CC_BY_NC',
          normalizedLicense: normalizedLicense({ commercialUsage: 'PersonalProfit' }),
        }),
      );
      await repo.create(
        makeInsert({
          name: 'NoMetadata',
          // intentionally no extraction-pipeline fields
        }),
      );
    });

    it('polyBucket filter matches exact bucket', async () => {
      const result = await repo.query({ polyBucket: 'mid' });
      expect(result.data.map((m) => m.name)).toEqual(['HumanoidMid']);
    });

    it('isHumanoid=true matches only true (NOT undefined)', async () => {
      const result = await repo.query({ isHumanoid: true });
      expect(result.data.map((m) => m.name).sort()).toEqual([
        'HumanoidHigh',
        'HumanoidMid',
      ]);
    });

    it('isHumanoid=false matches only false (NOT undefined)', async () => {
      const result = await repo.query({ isHumanoid: false });
      expect(result.data.map((m) => m.name)).toEqual(['NonHumanoidLow']);
    });

    it('license filter matches exact license name', async () => {
      const result = await repo.query({ license: 'CC_BY' });
      expect(result.data.map((m) => m.name)).toEqual(['HumanoidMid']);
    });

    it('hasCommercialUse=true permits Allow / PersonalProfit / Corporation, excludes Disallow + missing', async () => {
      const result = await repo.query({ hasCommercialUse: true });
      expect(result.data.map((m) => m.name).sort()).toEqual([
        'HumanoidHigh', // PersonalProfit
        'HumanoidMid',  // Allow
      ]);
    });

    it('hasCommercialUse=true with Corporation also permits', async () => {
      await repo.create(
        makeInsert({
          name: 'CorpUse',
          normalizedLicense: normalizedLicense({ commercialUsage: 'Corporation' }),
        }),
      );
      const result = await repo.query({ hasCommercialUse: true });
      expect(result.data.map((m) => m.name)).toContain('CorpUse');
    });

    it('hasCommercialUse=true excludes records without normalizedLicense (cannot assert stance)', async () => {
      const result = await repo.query({ hasCommercialUse: true });
      expect(result.data.map((m) => m.name)).not.toContain('NoMetadata');
    });

    it('multiple facets compose (AND)', async () => {
      const result = await repo.query({
        isHumanoid: true,
        polyBucket: 'mid',
      });
      expect(result.data.map((m) => m.name)).toEqual(['HumanoidMid']);
    });
  });

  // -------------------------------------------------------------------------
  // bulk + count
  // -------------------------------------------------------------------------

  describe('bulkCreate() / bulkDelete()', () => {
    it('bulkCreate inserts every record and returns them', async () => {
      const inserts = Array.from({ length: 5 }, (_, i) =>
        makeInsert({ name: `Bulk-${i}` }),
      );
      const result = await repo.bulkCreate(inserts);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(5);
      expect(await repo.count()).toBe(5);
    });

    it('bulkCreate honors a small batchSize and reports progress', async () => {
      const inserts = Array.from({ length: 4 }, (_, i) =>
        makeInsert({ name: `Bulk-${i}` }),
      );
      const progressTicks: number[] = [];
      const result = await repo.bulkCreate(inserts, {
        batchSize: 2,
        progressCallback: (p) => progressTicks.push(p.completed),
      });

      expect(result.success).toBe(true);
      expect(await repo.count()).toBe(4);
      // 4 records, batchSize 2 ⇒ two progress callbacks at completed=2 and 4.
      expect(progressTicks).toEqual([2, 4]);
    });

    it('bulkDelete removes the listed ids', async () => {
      const created = await repo.bulkCreate(
        Array.from({ length: 3 }, (_, i) => makeInsert({ name: `D-${i}` })),
      );
      const ids = created.data!.map((m) => m.id!).slice(0, 2);

      const result = await repo.bulkDelete(ids);
      expect(result.success).toBe(true);
      expect(await repo.count()).toBe(1);
    });
  });
});
