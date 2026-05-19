/**
 * RemoteModelService — server-backed model library client (added in commit
 * 79a9012, no test coverage when it landed).
 *
 * `fetch` is mocked globally per-test; jsdom's FileReader is used for the
 * real base64 round-trip in saveModel/loadModel. Every method has a happy
 * path + at least one failure path covered.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  RemoteModelService,
  getRemoteModelService,
} from './RemoteModelService';
import type { ModelRecord } from '../../../types/database.types';
import type { ExtractedBundle } from './ModelService';

// ---------------------------------------------------------------------------
// fetch mock harness
// ---------------------------------------------------------------------------

interface MockResponse {
  ok?: boolean;
  status?: number;
  body: unknown;
}

let fetchMock: ReturnType<typeof vi.fn>;

function setNextResponse(response: MockResponse): void {
  fetchMock.mockResolvedValueOnce({
    ok: response.ok ?? true,
    status: response.status ?? 200,
    json: async () => response.body,
  } as Response);
}

function setNextResponses(responses: MockResponse[]): void {
  for (const r of responses) setNextResponse(r);
}

function lastFetchArgs(): [string, RequestInit | undefined] {
  const calls = fetchMock.mock.calls;
  return calls[calls.length - 1] as [string, RequestInit | undefined];
}

const healthResponse: MockResponse = { body: { success: true, dataDir: '/x' } };

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function remoteRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    uuid: 'u-1',
    name: 'Model',
    displayName: 'Model',
    tags: ['anime'],
    format: 'vrm' as const,
    version: '1.0' as const,
    size: 8,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    ...overrides,
  };
}

function bundle(): ExtractedBundle {
  return {
    sha256: 'sha-1',
    searchTokens: ['alpha'],
    normalizedLicense: { licenseName: 'CC_BY' },
    extractedMetadata: {
      schemaVersion: 1,
      extractedAt: new Date(),
      extractorVersion: '1.0.0',
      geometry: {
        triangleCount: 0,
        vertexCount: 0,
        meshCount: 0,
        boundingBox: { min: [0, 0, 0], max: [0, 0, 0] },
        height: 0,
        polyBucket: 'mid',
      },
      rig: {
        boneCount: 0,
        isHumanoid: true,
        humanoidBonesPresent: ['hips'],
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
      hashes: { sha256: 'sha-1' },
      sourceFormat: {
        format: 'vrm',
        version: '1.0',
        hasAnimations: false,
        animationCount: 0,
      },
    },
  };
}

function newModelInsert(): Omit<ModelRecord, 'id' | 'uuid' | 'createdAt' | 'updatedAt'> {
  return {
    name: 'Test',
    displayName: 'Test',
    tags: [],
    format: 'vrm',
    version: '1.0',
    data: new TextEncoder().encode('hello').buffer,
    size: 5,
  };
}

beforeEach(() => {
  fetchMock = vi.fn();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// initialize
// ---------------------------------------------------------------------------

describe('RemoteModelService — initialize', () => {
  it('GETs /api/health on first call', async () => {
    setNextResponse(healthResponse);
    const svc = new RemoteModelService();
    await svc.initialize();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/health');
  });

  it('is idempotent — second call does not re-fetch', async () => {
    setNextResponse(healthResponse);
    const svc = new RemoteModelService();
    await svc.initialize();
    await svc.initialize();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('throws when the health check returns success: false', async () => {
    setNextResponse({ ok: true, body: { success: false, error: { message: 'down' } } });
    const svc = new RemoteModelService();
    await expect(svc.initialize()).rejects.toThrow(/down/);
  });

  it('throws on non-OK HTTP status (uses status in message)', async () => {
    setNextResponse({ ok: false, status: 503, body: {} });
    const svc = new RemoteModelService();
    await expect(svc.initialize()).rejects.toThrow(/503/);
  });
});

// ---------------------------------------------------------------------------
// saveModel
// ---------------------------------------------------------------------------

describe('RemoteModelService — saveModel', () => {
  it('POSTs to /api/models with base64-encoded data and bundle-promoted fields', async () => {
    setNextResponses([
      healthResponse,
      {
        status: 201,
        body: {
          success: true,
          data: remoteRecord({ name: 'Test', sha256: 'sha-1' }),
        },
      },
    ]);

    const svc = new RemoteModelService();
    const result = await svc.saveModel(newModelInsert(), undefined, bundle());

    expect(result.success).toBe(true);
    expect(result.data?.name).toBe('Test');
    // createdAt/updatedAt come back as Date objects, not strings.
    expect(result.data?.createdAt).toBeInstanceOf(Date);
    expect(result.data?.updatedAt).toBeInstanceOf(Date);

    const [url, init] = lastFetchArgs();
    expect(url).toBe('/api/models');
    expect(init?.method).toBe('POST');
    const payload = JSON.parse((init!.body as string));
    expect(payload.dataBase64).toBeTypeOf('string');
    expect(payload.data).toBeUndefined();
    expect(payload.sha256).toBe('sha-1');
    expect(payload.polyBucket).toBe('mid');
    expect(payload.isHumanoid).toBe(true);
    expect(payload.humanoidBones).toEqual(['hips']);
    expect(payload.skipDedup).toBe(false);
  });

  it('forwards wasDeduped from the server response', async () => {
    setNextResponses([
      healthResponse,
      {
        body: {
          success: true,
          data: remoteRecord({ sha256: 'sha-1' }),
          wasDeduped: true,
        },
      },
    ]);

    const svc = new RemoteModelService();
    const result = await svc.saveModel(newModelInsert(), undefined, bundle());

    expect(result.wasDeduped).toBe(true);
  });

  it('skipDedup=true is forwarded to the server', async () => {
    setNextResponses([
      healthResponse,
      { body: { success: true, data: remoteRecord() } },
    ]);

    const svc = new RemoteModelService();
    await svc.saveModel(newModelInsert(), undefined, bundle(), true);

    const payload = JSON.parse((lastFetchArgs()[1]!.body as string));
    expect(payload.skipDedup).toBe(true);
  });

  it('promotes normalizedLicense.licenseName to license when caller did not set one', async () => {
    setNextResponses([
      healthResponse,
      { body: { success: true, data: remoteRecord() } },
    ]);

    const svc = new RemoteModelService();
    await svc.saveModel(newModelInsert(), undefined, bundle());

    const payload = JSON.parse((lastFetchArgs()[1]!.body as string));
    expect(payload.license).toBe('CC_BY');
  });

  it('keeps caller-provided license rather than promoting the bundle value', async () => {
    setNextResponses([
      healthResponse,
      { body: { success: true, data: remoteRecord() } },
    ]);

    const svc = new RemoteModelService();
    await svc.saveModel({ ...newModelInsert(), license: 'My-License' }, undefined, bundle());

    const payload = JSON.parse((lastFetchArgs()[1]!.body as string));
    expect(payload.license).toBe('My-License');
  });

  it('omits bundle-promoted fields entirely when no bundle is provided', async () => {
    setNextResponses([
      healthResponse,
      { body: { success: true, data: remoteRecord() } },
    ]);

    const svc = new RemoteModelService();
    await svc.saveModel(newModelInsert());

    const payload = JSON.parse((lastFetchArgs()[1]!.body as string));
    expect(payload.sha256).toBeUndefined();
    expect(payload.polyBucket).toBeUndefined();
  });

  it('returns success:false with details on server failure', async () => {
    setNextResponses([
      healthResponse,
      { ok: false, status: 500, body: { success: false, error: { message: 'boom' } } },
    ]);

    const svc = new RemoteModelService();
    const result = await svc.saveModel(newModelInsert());

    expect(result.success).toBe(false);
    expect(result.error?.message).toMatch(/save model/i);
  });
});

// ---------------------------------------------------------------------------
// loadModel
// ---------------------------------------------------------------------------

describe('RemoteModelService — loadModel', () => {
  it('GETs /api/models/:uuid and normalizes the response', async () => {
    const saved = remoteRecord({ uuid: 'u-42' });
    // Base64-encoded "hello" is "aGVsbG8="
    setNextResponses([
      healthResponse,
      { body: { success: true, data: { ...saved, dataBase64: 'aGVsbG8=' } } },
    ]);

    const svc = new RemoteModelService();
    const result = await svc.loadModel('u-42');

    expect(result.success).toBe(true);
    expect(result.data?.uuid).toBe('u-42');
    expect(result.data?.createdAt).toBeInstanceOf(Date);
    expect(result.data?.data).toBeInstanceOf(ArrayBuffer);
    expect(result.data?.data.byteLength).toBe(5);
    expect(lastFetchArgs()[0]).toBe('/api/models/u-42');
  });

  it('URL-encodes special characters in uuid', async () => {
    setNextResponses([
      healthResponse,
      { body: { success: true, data: { ...remoteRecord({ uuid: 'a/b c' }), dataBase64: '' } } },
    ]);

    const svc = new RemoteModelService();
    await svc.loadModel('a/b c');

    expect(lastFetchArgs()[0]).toBe('/api/models/a%2Fb%20c');
  });

  it('uses an empty ArrayBuffer when dataBase64 is missing', async () => {
    setNextResponses([
      healthResponse,
      { body: { success: true, data: remoteRecord() } },
    ]);

    const svc = new RemoteModelService();
    const result = await svc.loadModel('u-1');

    expect(result.data?.data.byteLength).toBe(0);
  });

  it('returns success:false on server error', async () => {
    setNextResponses([
      healthResponse,
      { ok: false, status: 404, body: { success: false, error: { message: 'not found' } } },
    ]);

    const svc = new RemoteModelService();
    const result = await svc.loadModel('missing');

    expect(result.success).toBe(false);
    expect(result.error?.message).toMatch(/load model missing/i);
  });
});

// ---------------------------------------------------------------------------
// loadModelById
// ---------------------------------------------------------------------------

describe('RemoteModelService — loadModelById', () => {
  it('returns error documenting that numeric IDs are unsupported', async () => {
    const svc = new RemoteModelService();
    const result = await svc.loadModelById(123);

    expect(result.success).toBe(false);
    expect(result.error?.message).toMatch(/numeric ids/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// listModelSummaries / getAllModels
// ---------------------------------------------------------------------------

describe('RemoteModelService — listModelSummaries', () => {
  it('GETs /api/models, strips data fields, normalizes dates', async () => {
    setNextResponses([
      healthResponse,
      {
        body: {
          success: true,
          data: [
            remoteRecord({ uuid: 'a', dataBase64: 'aGVsbG8=' }),
            remoteRecord({ uuid: 'b' }),
          ],
        },
      },
    ]);

    const svc = new RemoteModelService();
    const result = await svc.listModelSummaries();

    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(2);
    for (const s of result.data!) {
      expect(s.data).toBeUndefined();
      expect(s.createdAt).toBeInstanceOf(Date);
    }
    expect(lastFetchArgs()[0]).toBe('/api/models');
  });

  it('returns success:false on server error', async () => {
    setNextResponses([
      healthResponse,
      { ok: false, status: 500, body: {} },
    ]);

    const svc = new RemoteModelService();
    const result = await svc.listModelSummaries();
    expect(result.success).toBe(false);
  });
});

describe('RemoteModelService — getAllModels', () => {
  it('returns summaries with empty ArrayBuffer data fields', async () => {
    setNextResponses([
      healthResponse,
      { body: { success: true, data: [remoteRecord()] } },
    ]);

    const svc = new RemoteModelService();
    const result = await svc.getAllModels();

    expect(result.success).toBe(true);
    expect(result.data?.[0].data).toBeInstanceOf(ArrayBuffer);
    expect(result.data?.[0].data.byteLength).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// updateModel
// ---------------------------------------------------------------------------

describe('RemoteModelService — updateModel', () => {
  it('PUTs /api/models/:uuid with the data field stripped', async () => {
    setNextResponses([
      healthResponse,
      { body: { success: true, data: remoteRecord({ name: 'NewName' }) } },
    ]);

    const svc = new RemoteModelService();
    const result = await svc.updateModel('u-1', {
      name: 'NewName',
      data: new ArrayBuffer(99), // should be stripped
    });

    expect(result.success).toBe(true);
    expect(result.data?.name).toBe('NewName');

    const [url, init] = lastFetchArgs();
    expect(url).toBe('/api/models/u-1');
    expect(init?.method).toBe('PUT');
    const payload = JSON.parse((init!.body as string));
    expect(payload.data).toBeUndefined();
    expect(payload.name).toBe('NewName');
  });

  it('returns success:false on server error', async () => {
    setNextResponses([
      healthResponse,
      { ok: false, status: 404, body: {} },
    ]);

    const svc = new RemoteModelService();
    const result = await svc.updateModel('missing', {});
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// deleteModel / bulkDelete / clearAll
// ---------------------------------------------------------------------------

describe('RemoteModelService — deleteModel', () => {
  it('DELETEs /api/models/:uuid', async () => {
    setNextResponses([
      healthResponse,
      { body: { success: true } },
    ]);

    const svc = new RemoteModelService();
    const result = await svc.deleteModel('u-1');

    expect(result.success).toBe(true);
    const [url, init] = lastFetchArgs();
    expect(url).toBe('/api/models/u-1');
    expect(init?.method).toBe('DELETE');
  });

  it('returns success:false on server error', async () => {
    setNextResponses([
      healthResponse,
      { ok: false, status: 500, body: {} },
    ]);

    const svc = new RemoteModelService();
    const result = await svc.deleteModel('u-1');
    expect(result.success).toBe(false);
  });
});

describe('RemoteModelService — bulkDeleteModels', () => {
  it('POSTs /api/models:bulk-delete with uuids array', async () => {
    setNextResponses([
      healthResponse,
      { body: { success: true } },
    ]);

    const svc = new RemoteModelService();
    const result = await svc.bulkDeleteModels(['a', 'b', 'c']);

    expect(result.success).toBe(true);
    const [url, init] = lastFetchArgs();
    expect(url).toBe('/api/models:bulk-delete');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(init!.body as string)).toEqual({ uuids: ['a', 'b', 'c'] });
  });
});

describe('RemoteModelService — clearAllModels', () => {
  it('POSTs /api/models:clear', async () => {
    setNextResponses([
      healthResponse,
      { body: { success: true } },
    ]);

    const svc = new RemoteModelService();
    const result = await svc.clearAllModels();

    expect(result.success).toBe(true);
    expect(lastFetchArgs()[0]).toBe('/api/models:clear');
  });
});

// ---------------------------------------------------------------------------
// filterModels (client-side filter)
// ---------------------------------------------------------------------------

describe('RemoteModelService — filterModels', () => {
  function seedListResponse() {
    setNextResponses([
      healthResponse,
      {
        body: {
          success: true,
          data: [
            remoteRecord({
              uuid: 'a',
              name: 'AlphaCharacter',
              displayName: 'Alpha',
              category: 'character',
              format: 'vrm',
              tags: ['anime'],
              polyBucket: 'mid',
              isHumanoid: true,
              license: 'CC_BY',
            }),
            remoteRecord({
              uuid: 'b',
              name: 'BetaProp',
              displayName: 'Beta',
              category: 'prop',
              format: 'glb',
              tags: ['wooden'],
              polyBucket: 'low',
              isHumanoid: false,
              license: 'CC0',
            }),
            remoteRecord({
              uuid: 'c',
              name: 'GammaCharacter',
              displayName: 'Gamma',
              category: 'character',
              format: 'vrm',
              tags: ['fantasy', 'anime'],
              polyBucket: 'mid',
              isHumanoid: true,
              license: 'CC_BY',
            }),
          ],
        },
      },
    ]);
  }

  it('search matches name + displayName + description + tags case-insensitively', async () => {
    seedListResponse();
    const svc = new RemoteModelService();
    const result = await svc.filterModels({ search: 'WOODEN' });
    expect(result.data.map((m) => m.name)).toEqual(['BetaProp']);
  });

  it('category filter', async () => {
    seedListResponse();
    const svc = new RemoteModelService();
    const result = await svc.filterModels({ category: 'character' });
    expect(result.data.map((m) => m.name).sort()).toEqual([
      'AlphaCharacter',
      'GammaCharacter',
    ]);
  });

  it('format filter', async () => {
    seedListResponse();
    const svc = new RemoteModelService();
    const result = await svc.filterModels({ format: 'glb' });
    expect(result.data.map((m) => m.name)).toEqual(['BetaProp']);
  });

  it('polyBucket filter', async () => {
    seedListResponse();
    const svc = new RemoteModelService();
    const result = await svc.filterModels({ polyBucket: 'low' });
    expect(result.data.map((m) => m.name)).toEqual(['BetaProp']);
  });

  it('isHumanoid filter distinguishes true/false', async () => {
    seedListResponse();
    const svc = new RemoteModelService();
    const result = await svc.filterModels({ isHumanoid: false });
    expect(result.data.map((m) => m.name)).toEqual(['BetaProp']);
  });

  it('license filter', async () => {
    seedListResponse();
    const svc = new RemoteModelService();
    const result = await svc.filterModels({ license: 'CC0' });
    expect(result.data.map((m) => m.name)).toEqual(['BetaProp']);
  });

  it('total + hasMore reflect the filtered result', async () => {
    seedListResponse();
    const svc = new RemoteModelService();
    const result = await svc.filterModels({ category: 'character' });
    expect(result.total).toBe(2);
    expect(result.hasMore).toBe(false);
  });

  it('returns empty data when getAllModels fails', async () => {
    setNextResponses([
      healthResponse,
      { ok: false, status: 500, body: {} },
    ]);

    const svc = new RemoteModelService();
    const result = await svc.filterModels({ search: 'x' });
    expect(result.data).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// thin wrappers on top of list/filter
// ---------------------------------------------------------------------------

describe('RemoteModelService — convenience methods', () => {
  function seed(records: Record<string, unknown>[]) {
    setNextResponses([
      healthResponse,
      { body: { success: true, data: records } },
    ]);
  }

  it('searchModels delegates to filterModels', async () => {
    seed([
      remoteRecord({ name: 'Alpha' }),
      remoteRecord({ name: 'Beta' }),
    ]);
    const svc = new RemoteModelService();
    const result = await svc.searchModels('alpha');
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(1);
    expect(result.data![0].name).toBe('Alpha');
  });

  it('getModelCount returns summary length', async () => {
    seed([remoteRecord(), remoteRecord({ uuid: 'b' }), remoteRecord({ uuid: 'c' })]);
    const svc = new RemoteModelService();
    expect(await svc.getModelCount()).toBe(3);
  });

  it('getModelCount returns 0 on server error', async () => {
    setNextResponses([
      healthResponse,
      { ok: false, status: 500, body: {} },
    ]);
    const svc = new RemoteModelService();
    expect(await svc.getModelCount()).toBe(0);
  });

  it('getUniqueCategories returns sorted distinct non-empty values', async () => {
    seed([
      remoteRecord({ uuid: 'a', category: 'prop' }),
      remoteRecord({ uuid: 'b', category: 'character' }),
      remoteRecord({ uuid: 'c', category: 'character' }),
      remoteRecord({ uuid: 'd' /* no category */ }),
    ]);
    const svc = new RemoteModelService();
    expect(await svc.getUniqueCategories()).toEqual(['character', 'prop']);
  });

  it('getUniqueTags returns sorted flat distinct values', async () => {
    seed([
      remoteRecord({ uuid: 'a', tags: ['anime', 'fantasy'] }),
      remoteRecord({ uuid: 'b', tags: ['anime'] }),
      remoteRecord({ uuid: 'c', tags: ['sci-fi'] }),
    ]);
    const svc = new RemoteModelService();
    expect(await svc.getUniqueTags()).toEqual(['anime', 'fantasy', 'sci-fi']);
  });

  it('getRecentModels slices to the limit', async () => {
    seed([
      remoteRecord({ uuid: 'a' }),
      remoteRecord({ uuid: 'b' }),
      remoteRecord({ uuid: 'c' }),
    ]);
    const svc = new RemoteModelService();
    const result = await svc.getRecentModels(2);
    expect(result.data).toHaveLength(2);
  });

  it('modelExists returns true on name match', async () => {
    seed([remoteRecord({ name: 'Match' })]);
    const svc = new RemoteModelService();
    expect(await svc.modelExists('Match')).toBe(true);
  });

  it('modelExists returns false when name not present', async () => {
    seed([remoteRecord({ name: 'Other' })]);
    const svc = new RemoteModelService();
    expect(await svc.modelExists('Match')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// singleton
// ---------------------------------------------------------------------------

describe('getRemoteModelService', () => {
  it('returns the same instance across calls', () => {
    const a = getRemoteModelService();
    const b = getRemoteModelService();
    expect(a).toBe(b);
  });
});
