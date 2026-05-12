/**
 * AnimationRepository — full coverage against a fake-indexeddb-backed Dexie.
 *
 * Mirrors `ModelRepository.crud.test.ts` for the animations table: every test
 * starts with an empty `animations` table and seeds via `repo.create()`. The
 * Animation repository doesn't have the extraction-pipeline facet fields, so
 * the surface area is smaller — base CRUD + query() + bulk ops.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AnimationRepository } from './AnimationRepository';
import { getDatabase } from '../schemas/databaseSchema';
import type { AnimationRecord } from '../../../types/database.types';

type AnimInsert = Omit<AnimationRecord, 'id' | 'uuid' | 'createdAt' | 'updatedAt'>;

function makeInsert(overrides: Partial<AnimInsert> = {}): AnimInsert {
  return {
    name: 'TestAnim',
    displayName: 'Test Anim',
    description: 'fixture',
    category: 'idle',
    tags: ['locomotion'],
    format: 'bvh',
    duration: 1.5,
    fps: 30,
    frameCount: 45,
    author: 'Author A',
    license: 'CC_BY',
    data: new ArrayBuffer(8),
    size: 8,
    ...overrides,
  };
}

describe('AnimationRepository (integration)', () => {
  let repo: AnimationRepository;

  beforeEach(async () => {
    await getDatabase().animations.clear();
    repo = new AnimationRepository();
  });

  afterEach(async () => {
    await getDatabase().animations.clear();
  });

  // -------------------------------------------------------------------------
  // create + read
  // -------------------------------------------------------------------------

  describe('create()', () => {
    it('inserts a record and returns it with auto-assigned uuid + timestamps', async () => {
      const before = Date.now();
      const result = await repo.create(makeInsert({ name: 'A' }));
      const after = Date.now();

      expect(result.success).toBe(true);
      expect(result.data!.uuid).toMatch(/^[0-9a-f-]{36}$/);
      expect(result.data!.createdAt.getTime()).toBeGreaterThanOrEqual(before);
      expect(result.data!.createdAt.getTime()).toBeLessThanOrEqual(after);
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
    });

    it('getByName returns an empty array (success) when no record matches', async () => {
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
      await new Promise((r) => setTimeout(r, 5));

      const updated = await repo.update(created.id!, { name: 'New', duration: 3 });
      expect(updated.success).toBe(true);
      expect(updated.data!.name).toBe('New');
      expect(updated.data!.duration).toBe(3);
      expect(updated.data!.updatedAt.getTime()).toBeGreaterThanOrEqual(
        originalUpdatedAt,
      );
    });

    it('update returns NOT_FOUND for unknown id', async () => {
      const result = await repo.update(9999, { name: 'x' });
      expect(result.success).toBe(false);
      expect(result.error?.type).toBe('NOT_FOUND');
    });

    it('updateByUuid mutates the matching record', async () => {
      const created = (await repo.create(makeInsert({ tags: ['old'] }))).data!;
      const result = await repo.updateByUuid(created.uuid, {
        tags: ['new', 'tags'],
      });
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
    it('delete removes by id', async () => {
      const created = (await repo.create(makeInsert())).data!;
      expect((await repo.delete(created.id!)).success).toBe(true);
      expect((await repo.getById(created.id!)).success).toBe(false);
    });

    it('deleteByUuid removes by uuid', async () => {
      const created = (await repo.create(makeInsert())).data!;
      expect((await repo.deleteByUuid(created.uuid)).success).toBe(true);
      expect((await repo.getByUuid(created.uuid)).success).toBe(false);
    });

    it('deleteByUuid returns NOT_FOUND for unknown uuid', async () => {
      const result = await repo.deleteByUuid('does-not-exist');
      expect(result.success).toBe(false);
      expect(result.error?.type).toBe('NOT_FOUND');
    });
  });

  // -------------------------------------------------------------------------
  // getAll + count + clear
  // -------------------------------------------------------------------------

  describe('getAll() / count() / clear()', () => {
    it('getAll returns every record', async () => {
      await repo.create(makeInsert({ name: 'A' }));
      await repo.create(makeInsert({ name: 'B' }));

      const result = await repo.getAll();
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
    });

    it('count reflects table size', async () => {
      expect(await repo.count()).toBe(0);
      await repo.create(makeInsert());
      await repo.create(makeInsert());
      expect(await repo.count()).toBe(2);
    });

    it('clear empties the table', async () => {
      await repo.create(makeInsert());
      expect(await repo.count()).toBe(1);
      expect((await repo.clear()).success).toBe(true);
      expect(await repo.count()).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // query
  // -------------------------------------------------------------------------

  describe('query() — filters + sort + pagination', () => {
    beforeEach(async () => {
      await repo.create(
        makeInsert({
          name: 'IdleLoop',
          displayName: 'Idle',
          category: 'idle',
          format: 'vrma',
          tags: ['standing'],
          duration: 2.0,
        }),
      );
      await repo.create(
        makeInsert({
          name: 'WalkCycle',
          displayName: 'Walk',
          category: 'locomotion',
          format: 'bvh',
          tags: ['walking'],
          duration: 1.0,
        }),
      );
      await repo.create(
        makeInsert({
          name: 'RunCycle',
          displayName: 'Run',
          category: 'locomotion',
          format: 'bvh',
          tags: ['running', 'walking'],
          duration: 0.5,
        }),
      );
    });

    it('search matches name / displayName / description / tags', async () => {
      const byName = await repo.query({ search: 'idle' });
      expect(byName.data.map((a) => a.name)).toEqual(['IdleLoop']);

      const byTag = await repo.query({ search: 'WALKING' });
      expect(byTag.data.map((a) => a.name).sort()).toEqual([
        'RunCycle',
        'WalkCycle',
      ]);
    });

    it('category filter restricts to matches', async () => {
      const result = await repo.query({ category: 'locomotion' });
      expect(result.data).toHaveLength(2);
    });

    it('format filter restricts to matches', async () => {
      const result = await repo.query({ format: 'vrma' });
      expect(result.data.map((a) => a.name)).toEqual(['IdleLoop']);
    });

    it('tags filter is OR-of-tags', async () => {
      const result = await repo.query({ tags: ['standing', 'running'] });
      expect(result.data.map((a) => a.name).sort()).toEqual([
        'IdleLoop',
        'RunCycle',
      ]);
    });

    it('orderBy name asc/desc', async () => {
      const asc = await repo.query({ orderBy: 'name', orderDirection: 'asc' });
      expect(asc.data.map((a) => a.name)).toEqual([
        'IdleLoop',
        'RunCycle',
        'WalkCycle',
      ]);
      const desc = await repo.query({ orderBy: 'name', orderDirection: 'desc' });
      expect(desc.data.map((a) => a.name)).toEqual([
        'WalkCycle',
        'RunCycle',
        'IdleLoop',
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
      expect(page1.hasMore).toBe(true);

      const page2 = await repo.query({
        orderBy: 'name',
        orderDirection: 'asc',
        limit: 2,
        offset: 2,
      });
      expect(page2.data).toHaveLength(1);
      expect(page2.hasMore).toBe(false);
    });

    it('date range filters by createdAt', async () => {
      const future = new Date(Date.now() + 60_000);
      const empty = await repo.query({ startDate: future });
      expect(empty.data).toHaveLength(0);

      const all = await repo.query({
        endDate: new Date(Date.now() + 60_000),
      });
      expect(all.data).toHaveLength(3);
    });
  });

  // -------------------------------------------------------------------------
  // bulk
  // -------------------------------------------------------------------------

  describe('bulkCreate() / bulkDelete()', () => {
    it('bulkCreate inserts every record', async () => {
      const inserts = Array.from({ length: 5 }, (_, i) =>
        makeInsert({ name: `Bulk-${i}` }),
      );
      const result = await repo.bulkCreate(inserts);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(5);
      expect(await repo.count()).toBe(5);
    });

    it('bulkCreate honors batchSize and reports progress', async () => {
      const inserts = Array.from({ length: 4 }, (_, i) =>
        makeInsert({ name: `Bulk-${i}` }),
      );
      const ticks: number[] = [];
      await repo.bulkCreate(inserts, {
        batchSize: 2,
        progressCallback: (p) => ticks.push(p.completed),
      });
      expect(ticks).toEqual([2, 4]);
    });

    it('bulkDelete removes the listed ids', async () => {
      const created = await repo.bulkCreate(
        Array.from({ length: 3 }, (_, i) => makeInsert({ name: `D-${i}` })),
      );
      const ids = created.data!.map((a) => a.id!).slice(0, 2);

      expect((await repo.bulkDelete(ids)).success).toBe(true);
      expect(await repo.count()).toBe(1);
    });
  });
});
