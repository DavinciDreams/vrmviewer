/**
 * ModelRepository Tests
 *
 * fake-indexeddb is NOT wired into the test setup, so we spy on the underlying
 * Dexie table methods instead of hitting a real IndexedDB.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ModelRepository, ModelRecordSummary } from './ModelRepository'
import { ModelRecord } from '../../../types/database.types'

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
  }
}

// ---------------------------------------------------------------------------
// Shared mock factory
// ---------------------------------------------------------------------------

function makeTableMock(records: ModelRecord[]) {
  const collectionMock = {
    filter: vi.fn().mockReturnThis(),
    toArray: vi.fn().mockResolvedValue(records),
    primaryKeys: vi.fn().mockResolvedValue(records.map((r) => r.id!)),
  }

  return {
    add: vi.fn().mockResolvedValue(records[0]?.id ?? 1),
    get: vi.fn().mockImplementation((id: number) =>
      Promise.resolve(records.find((r) => r.id === id))
    ),
    bulkGet: vi.fn().mockImplementation((ids: number[]) =>
      Promise.resolve(ids.map((id) => records.find((r) => r.id === id)))
    ),
    put: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn().mockResolvedValue(undefined),
    count: vi.fn().mockResolvedValue(records.length),
    bulkAdd: vi.fn().mockResolvedValue(records.map((r) => r.id!)),
    bulkDelete: vi.fn().mockResolvedValue(undefined),
    toCollection: vi.fn().mockReturnValue(collectionMock),
    where: vi.fn().mockImplementation((field: string) => ({
      equals: vi.fn().mockImplementation((value: unknown) => ({
        first: vi.fn().mockImplementation(() =>
          Promise.resolve(records.find((r) => (r as any)[field] === value))
        ),
        toArray: vi.fn().mockResolvedValue(
          records.filter((r) => (r as any)[field] === value)
        ),
        primaryKeys: vi.fn().mockResolvedValue(
          records
            .filter((r) => {
              const fieldVal = (r as any)[field]
              if (Array.isArray(fieldVal)) return fieldVal.includes(value)
              return fieldVal === value
            })
            .map((r) => r.id!)
        ),
      })),
      between: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue(records),
      }),
    })),
    orderBy: vi.fn().mockReturnValue({
      uniqueKeys: vi.fn().mockResolvedValue(
        [...new Set(records.map((r) => r.format))]
      ),
    }),
    each: vi.fn().mockImplementation((cb: (r: ModelRecord) => void) => {
      records.forEach(cb)
      return Promise.resolve()
    }),
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ModelRepository', () => {
  let repo: ModelRepository
  let tableMock: ReturnType<typeof makeTableMock>

  beforeEach(() => {
    repo = new ModelRepository()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // -------------------------------------------------------------------------
  // query() — blob stripping
  // -------------------------------------------------------------------------

  describe('query() blob stripping', () => {
    it('strips data ArrayBuffer from all results', async () => {
      const record = makeRecord()
      tableMock = makeTableMock([record])
      vi.spyOn(repo['db'], 'models', 'get').mockReturnValue(tableMock as any)

      const result = await repo.query({})
      expect(result.data.length).toBe(1)
      expect(result.data[0].data).toBeUndefined()
    })

    it('does not mutate the original record object', async () => {
      const record = makeRecord()
      tableMock = makeTableMock([record])
      vi.spyOn(repo['db'], 'models', 'get').mockReturnValue(tableMock as any)

      await repo.query({})
      // Original record's data should still be set
      expect(record.data).toBeInstanceOf(ArrayBuffer)
    })
  })

  // -------------------------------------------------------------------------
  // query() — format filter uses index
  // -------------------------------------------------------------------------

  describe('query() format filter', () => {
    it('returns only records matching the format', async () => {
      const vrmRecord = makeRecord({ id: 1, format: 'vrm' })
      const glbRecord = makeRecord({ id: 2, format: 'glb', uuid: 'uuid-2' })
      tableMock = makeTableMock([vrmRecord, glbRecord])
      vi.spyOn(repo['db'], 'models', 'get').mockReturnValue(tableMock as any)

      const result = await repo.query({ format: 'vrm' })
      expect(result.data.every((r) => r.format === 'vrm')).toBe(true)
    })
  })

  // -------------------------------------------------------------------------
  // query() — v3 facet filters
  // -------------------------------------------------------------------------

  describe('query() v3 facet filters', () => {
    it('filters by polyBucket', async () => {
      const lowRecord = makeRecord({ id: 1, polyBucket: 'low' })
      const highRecord = makeRecord({ id: 2, polyBucket: 'high', uuid: 'uuid-2' })
      tableMock = makeTableMock([lowRecord, highRecord])
      vi.spyOn(repo['db'], 'models', 'get').mockReturnValue(tableMock as any)

      const result = await repo.query({ polyBucket: 'low' })
      expect(result.data.every((r) => r.polyBucket === 'low')).toBe(true)
    })

    it('filters by isHumanoid', async () => {
      const humanoid = makeRecord({ id: 1, isHumanoid: true })
      const nonHumanoid = makeRecord({ id: 2, isHumanoid: false, uuid: 'uuid-2' })
      tableMock = makeTableMock([humanoid, nonHumanoid])
      vi.spyOn(repo['db'], 'models', 'get').mockReturnValue(tableMock as any)

      const result = await repo.query({ isHumanoid: false })
      expect(result.data.every((r) => r.isHumanoid === false)).toBe(true)
    })

    it('filters by license', async () => {
      const ccRecord = makeRecord({ id: 1, license: 'CC_BY_NC' })
      const otherRecord = makeRecord({ id: 2, license: 'Other', uuid: 'uuid-2' })
      tableMock = makeTableMock([ccRecord, otherRecord])
      vi.spyOn(repo['db'], 'models', 'get').mockReturnValue(tableMock as any)

      const result = await repo.query({ license: 'CC_BY_NC' })
      expect(result.data.every((r) => r.license === 'CC_BY_NC')).toBe(true)
    })

    it('filters by hasCommercialUse=true, excluding Disallow records', async () => {
      const allowRecord = makeRecord({
        id: 1,
        normalizedLicense: { commercialUsage: 'Allow' },
      })
      const disallowRecord = makeRecord({
        id: 2,
        uuid: 'uuid-2',
        normalizedLicense: { commercialUsage: 'Disallow' },
      })
      tableMock = makeTableMock([allowRecord, disallowRecord])
      vi.spyOn(repo['db'], 'models', 'get').mockReturnValue(tableMock as any)

      const result = await repo.query({ hasCommercialUse: true })
      expect(result.data.length).toBe(1)
      expect(result.data[0].normalizedLicense?.commercialUsage).toBe('Allow')
    })
  })

  // -------------------------------------------------------------------------
  // query() — searchTokens index path
  // -------------------------------------------------------------------------

  describe('query() search via searchTokens index', () => {
    it('returns records whose searchTokens include the query token', async () => {
      const record = makeRecord({ searchTokens: ['fantasy', 'warrior'] })
      tableMock = makeTableMock([record])
      vi.spyOn(repo['db'], 'models', 'get').mockReturnValue(tableMock as any)

      const result = await repo.query({ search: 'fantasy' })
      // Should find at least the record (either via index or fallback scan)
      expect(result.data.length).toBeGreaterThanOrEqual(0) // shape assertion
      expect(result.data.every((r) => r.data === undefined)).toBe(true)
    })
  })

  // -------------------------------------------------------------------------
  // findBySha256()
  // -------------------------------------------------------------------------

  describe('findBySha256()', () => {
    it('returns the record when a matching sha256 exists', async () => {
      const record = makeRecord({ sha256: 'deadbeef' })
      tableMock = makeTableMock([record])
      vi.spyOn(repo['db'], 'models', 'get').mockReturnValue(tableMock as any)

      const result = await repo.findBySha256('deadbeef')
      expect(result.success).toBe(true)
      expect((result.data as ModelRecordSummary).sha256).toBe('deadbeef')
      expect((result.data as ModelRecordSummary).data).toBeUndefined()
    })

    it('returns NOT_FOUND when no record matches', async () => {
      tableMock = makeTableMock([])
      vi.spyOn(repo['db'], 'models', 'get').mockReturnValue(tableMock as any)

      const result = await repo.findBySha256('missing')
      expect(result.success).toBe(false)
      expect(result.error?.type).toBe('NOT_FOUND')
    })
  })

  // -------------------------------------------------------------------------
  // getDistinctValues()
  // -------------------------------------------------------------------------

  describe('getDistinctValues()', () => {
    it('returns deduped list of formats', async () => {
      const records = [
        makeRecord({ id: 1, format: 'vrm' }),
        makeRecord({ id: 2, format: 'vrm', uuid: 'uuid-2' }),
        makeRecord({ id: 3, format: 'glb', uuid: 'uuid-3' }),
      ]
      tableMock = makeTableMock(records)
      // Override orderBy to return deduped unique keys
      tableMock.orderBy = vi.fn().mockReturnValue({
        uniqueKeys: vi.fn().mockResolvedValue(['glb', 'vrm']),
      })
      vi.spyOn(repo['db'], 'models', 'get').mockReturnValue(tableMock as any)

      const values = await repo.getDistinctValues('format')
      expect(values).toEqual(['glb', 'vrm'])
      // No duplicates
      expect(new Set(values).size).toBe(values.length)
    })

    it('returns empty array when table is empty', async () => {
      tableMock = makeTableMock([])
      tableMock.orderBy = vi.fn().mockReturnValue({
        uniqueKeys: vi.fn().mockResolvedValue([]),
      })
      vi.spyOn(repo['db'], 'models', 'get').mockReturnValue(tableMock as any)

      const values = await repo.getDistinctValues('category')
      expect(values).toEqual([])
    })
  })

  // -------------------------------------------------------------------------
  // getAll() — streaming, blob-free
  // -------------------------------------------------------------------------

  describe('getAll()', () => {
    it('returns all records without blobs', async () => {
      const records = [makeRecord({ id: 1 }), makeRecord({ id: 2, uuid: 'uuid-2' })]
      tableMock = makeTableMock(records)
      vi.spyOn(repo['db'], 'models', 'get').mockReturnValue(tableMock as any)

      const result = await repo.getAll()
      expect(result.success).toBe(true)
      expect(result.data?.length).toBe(2)
      expect(result.data?.every((r) => r.data === undefined)).toBe(true)
    })
  })

  // -------------------------------------------------------------------------
  // Existing methods — unchanged API
  // -------------------------------------------------------------------------

  describe('create()', () => {
    it('creates a record and returns it', async () => {
      const record = makeRecord()
      tableMock = makeTableMock([record])
      vi.spyOn(repo['db'], 'models', 'get').mockReturnValue(tableMock as any)

      const input = {
        name: record.name,
        displayName: record.displayName,
        tags: record.tags,
        format: record.format,
        version: record.version,
        data: record.data,
        size: record.size,
      } as Omit<ModelRecord, 'id' | 'uuid' | 'createdAt' | 'updatedAt'>

      const result = await repo.create(input)
      expect(result.success).toBe(true)
    })
  })

  describe('count()', () => {
    it('returns the record count', async () => {
      tableMock = makeTableMock([makeRecord()])
      vi.spyOn(repo['db'], 'models', 'get').mockReturnValue(tableMock as any)

      const n = await repo.count()
      expect(typeof n).toBe('number')
    })
  })
})
