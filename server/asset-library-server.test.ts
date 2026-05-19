/**
 * asset-library-server — HTTP integration tests for the original CRUD
 * endpoints (the surface RemoteModelService.ts calls).
 *
 * The server grew significantly in 17800ec to include Hill API integration,
 * file-backed asset discovery, marketplace integration etc. Those are
 * intentionally OUT OF SCOPE here — this slice covers only the persistence
 * primitives that the client depends on, so a regression in the core save /
 * load / list / update / delete path can be caught.
 *
 * Approach
 * - Import `handle` after stubbing `ASSET_LIBRARY_DATA_DIR` so the module
 *   reads our isolated tmp dir at eval time.
 * - Spin up `createServer(handle).listen(0)` once per test file for a
 *   random unused port.
 * - Use `POST /api/models:clear` between tests for a clean slate.
 * - Close the server + remove tmp dir in afterAll.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi,
} from 'vitest';
import { createServer, type Server } from 'node:http';
import { mkdir, rm, readdir } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

// ---------------------------------------------------------------------------
// Shared state — initialized in beforeAll
// ---------------------------------------------------------------------------

let server: Server;
let baseUrl: string;
let tmpDir: string;

beforeAll(async () => {
  tmpDir = path.join(
    os.tmpdir(),
    `asset-library-test-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
  );
  await mkdir(tmpDir, { recursive: true });

  // Must stub BEFORE importing the module — the server reads
  // process.env.ASSET_LIBRARY_DATA_DIR at top-level evaluation time.
  vi.stubEnv('ASSET_LIBRARY_DATA_DIR', tmpDir);
  vi.stubEnv('ASSET_LIBRARY_HOST', '127.0.0.1');

  const { handle } = await import('./asset-library-server.mjs');

  server = createServer(handle as any);
  await new Promise<void>((resolve) =>
    server.listen(0, '127.0.0.1', () => resolve()),
  );
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  baseUrl = `http://127.0.0.1:${port}`;
}, 15_000);

afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve())),
  );
  await rm(tmpDir, { recursive: true, force: true });
  vi.unstubAllEnvs();
});

beforeEach(async () => {
  // Clear models between tests so each starts with a clean slate.
  await fetch(`${baseUrl}/api/models:clear`, { method: 'POST' });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Base64-encode a known string for body payloads. */
function helloB64(): string {
  return Buffer.from('hello').toString('base64');
}

interface SaveBody {
  name?: string;
  format?: string;
  size?: number;
  tags?: string[];
  category?: string;
  sha256?: string;
  skipDedup?: boolean;
  license?: string;
  [k: string]: unknown;
}

async function postModel(overrides: SaveBody = {}) {
  const body = {
    name: 'TestModel',
    displayName: 'TestModel',
    format: 'vrm',
    tags: [],
    size: 5,
    dataBase64: helloB64(),
    ...overrides,
  };
  const response = await fetch(`${baseUrl}/api/models`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { response, body: await response.json() };
}

// ---------------------------------------------------------------------------
// /api/health
// ---------------------------------------------------------------------------

describe('GET /api/health', () => {
  it('returns success + the configured data dir', async () => {
    const response = await fetch(`${baseUrl}/api/health`);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.dataDir).toBe(tmpDir);
  });
});

// ---------------------------------------------------------------------------
// /api/models — GET + POST
// ---------------------------------------------------------------------------

describe('GET /api/models', () => {
  it('returns an empty list on a fresh server', async () => {
    const response = await fetch(`${baseUrl}/api/models`);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data).toEqual([]);
  });

  it('returns saved records (data stripped) sorted most-recent first', async () => {
    await postModel({ name: 'A' });
    // Brief gap so updatedAt/createdAt timestamps strictly increase.
    await new Promise((r) => setTimeout(r, 5));
    await postModel({ name: 'B' });

    const response = await fetch(`${baseUrl}/api/models`);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(2);
    expect(body.data[0].name).toBe('B'); // newest first
    expect(body.data[1].name).toBe('A');
    // The list endpoint strips the binary payload.
    expect(body.data[0].dataBase64).toBeUndefined();
    expect(body.data[0].data).toBeUndefined();
  });
});

describe('POST /api/models', () => {
  it('returns 201 with the persisted record on first save', async () => {
    const { response, body } = await postModel({ name: 'First' });

    expect(response.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.wasDeduped).toBe(false);
    expect(body.data.uuid).toMatch(/^[0-9a-f-]{36}$/i);
    expect(body.data.name).toBe('First');
    expect(body.data.size).toBe(5); // byteLength of "hello"
    expect(typeof body.data.createdAt).toBe('string');
    expect(new Date(body.data.createdAt).toString()).not.toBe('Invalid Date');
  });

  it('writes the record metadata + binary file under DATA_DIR/models/<uuid>/', async () => {
    const { body } = await postModel({ name: 'OnDisk' });
    const dir = path.join(tmpDir, 'models', body.data.uuid);
    const entries = await readdir(dir);

    expect(entries).toContain('metadata.json');
    expect(entries).toContain('model.vrm');
  });

  it('dedup: a second POST with the same sha256 returns 200 + wasDeduped=true + the existing record', async () => {
    const first = await postModel({ name: 'First', sha256: 'shared-hash' });
    const second = await postModel({
      name: 'Second',
      sha256: 'shared-hash',
    });

    expect(first.response.status).toBe(201);
    expect(second.response.status).toBe(200);
    expect(second.body.wasDeduped).toBe(true);
    expect(second.body.data.uuid).toBe(first.body.data.uuid);
    expect(second.body.data.name).toBe('First'); // existing record returned

    // List should still hold exactly one record.
    const list = await (await fetch(`${baseUrl}/api/models`)).json();
    expect(list.data).toHaveLength(1);
  });

  it('skipDedup=true bypasses the sha256 check even on collision', async () => {
    await postModel({ name: 'First', sha256: 'shared-hash' });
    const second = await postModel({
      name: 'AsCopy',
      sha256: 'shared-hash',
      skipDedup: true,
    });

    expect(second.response.status).toBe(201);
    expect(second.body.wasDeduped).toBe(false);

    const list = await (await fetch(`${baseUrl}/api/models`)).json();
    expect(list.data).toHaveLength(2);
  });

  it('rejects unsupported formats with a 500', async () => {
    const { response, body } = await postModel({ format: 'obj' });
    expect(response.status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.error?.message).toMatch(/format/i);
  });

  it('rejects missing dataBase64 with a 500', async () => {
    const response = await fetch(`${baseUrl}/api/models`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'No-Data', format: 'vrm' }),
    });
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error?.message).toMatch(/dataBase64/i);
  });
});

// ---------------------------------------------------------------------------
// /api/models/:uuid — GET + PUT + DELETE
// ---------------------------------------------------------------------------

describe('GET /api/models/:uuid', () => {
  it('returns the full record including dataBase64', async () => {
    const saved = await postModel({ name: 'Fetched' });
    const uuid = saved.body.data.uuid;

    const response = await fetch(`${baseUrl}/api/models/${uuid}`);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.name).toBe('Fetched');
    expect(body.data.dataBase64).toBe(helloB64());
  });

  it('returns 404 when uuid is not found', async () => {
    const response = await fetch(`${baseUrl}/api/models/does-not-exist`);
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error?.message).toMatch(/not found/i);
  });
});

describe('PUT /api/models/:uuid', () => {
  it('updates editable fields and returns the new record', async () => {
    const saved = await postModel({ name: 'Old' });
    const uuid = saved.body.data.uuid;

    const response = await fetch(`${baseUrl}/api/models/${uuid}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'New', description: 'updated' }),
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.name).toBe('New');
    expect(body.data.description).toBe('updated');
    expect(body.data.uuid).toBe(uuid);
  });

  it('returns 404 when uuid is not found', async () => {
    const response = await fetch(`${baseUrl}/api/models/missing`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'x' }),
    });
    expect(response.status).toBe(404);
  });
});

describe('DELETE /api/models/:uuid', () => {
  it('removes the record + its directory from disk', async () => {
    const saved = await postModel({ name: 'ToDelete' });
    const uuid = saved.body.data.uuid;

    const response = await fetch(`${baseUrl}/api/models/${uuid}`, {
      method: 'DELETE',
    });
    expect(response.status).toBe(200);

    const list = await (await fetch(`${baseUrl}/api/models`)).json();
    expect(list.data).toHaveLength(0);

    const subsequent = await fetch(`${baseUrl}/api/models/${uuid}`);
    expect(subsequent.status).toBe(404);
  });

  it('still returns 200 when deleting a non-existent uuid (rm -rf semantics)', async () => {
    const response = await fetch(`${baseUrl}/api/models/never-existed`, {
      method: 'DELETE',
    });
    expect(response.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// /api/models:bulk-delete + :clear
// ---------------------------------------------------------------------------

describe('POST /api/models:bulk-delete', () => {
  it('removes every uuid in the list', async () => {
    const a = await postModel({ name: 'A' });
    const b = await postModel({ name: 'B' });
    const c = await postModel({ name: 'C' });

    const response = await fetch(`${baseUrl}/api/models:bulk-delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uuids: [a.body.data.uuid, b.body.data.uuid] }),
    });
    expect(response.status).toBe(200);

    const list = await (await fetch(`${baseUrl}/api/models`)).json();
    expect(list.data).toHaveLength(1);
    expect(list.data[0].uuid).toBe(c.body.data.uuid);
  });

  it('tolerates a non-array `uuids` field (treats as empty)', async () => {
    await postModel();
    const response = await fetch(`${baseUrl}/api/models:bulk-delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uuids: 'oops' }),
    });
    expect(response.status).toBe(200);

    const list = await (await fetch(`${baseUrl}/api/models`)).json();
    expect(list.data).toHaveLength(1); // no deletion happened
  });
});

describe('POST /api/models:clear', () => {
  it('removes every stored record', async () => {
    await postModel({ name: 'A' });
    await postModel({ name: 'B' });
    expect((await (await fetch(`${baseUrl}/api/models`)).json()).data).toHaveLength(2);

    const response = await fetch(`${baseUrl}/api/models:clear`, {
      method: 'POST',
    });
    expect(response.status).toBe(200);

    const list = await (await fetch(`${baseUrl}/api/models`)).json();
    expect(list.data).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// /api/statistics
// ---------------------------------------------------------------------------

describe('GET /api/statistics', () => {
  it('returns zeros on an empty library', async () => {
    const body = await (await fetch(`${baseUrl}/api/statistics`)).json();
    expect(body.totalModels).toBe(0);
    expect(body.totalSize).toBe(0);
    expect(body.formats).toEqual({});
    expect(body.categories).toEqual({});
  });

  it('aggregates totalSize + per-format + per-category counts', async () => {
    await postModel({ name: 'A', format: 'vrm', category: 'character' });
    await postModel({ name: 'B', format: 'vrm', category: 'character' });
    await postModel({ name: 'C', format: 'glb', category: 'prop' });

    const body = await (await fetch(`${baseUrl}/api/statistics`)).json();
    expect(body.totalModels).toBe(3);
    expect(body.totalSize).toBe(15); // 3 × 5 bytes ("hello")
    expect(body.formats.vrm).toBe(2);
    expect(body.formats.glb).toBe(1);
    expect(body.categories.character).toBe(2);
    expect(body.categories.prop).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// CORS preflight + 404
// ---------------------------------------------------------------------------

describe('OPTIONS preflight', () => {
  it('returns 204 with CORS headers', async () => {
    const response = await fetch(`${baseUrl}/api/models`, { method: 'OPTIONS' });
    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe('*');
    expect(response.headers.get('access-control-allow-methods')).toMatch(
      /GET.*POST.*PUT.*DELETE/i,
    );
    expect(response.headers.get('access-control-allow-headers')).toMatch(
      /content-type/i,
    );
  });
});

describe('unknown route fallthrough', () => {
  it('returns 404 with a "No route" message for unrecognised /api paths', async () => {
    const response = await fetch(`${baseUrl}/api/does-not-exist`);
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error?.message).toMatch(/no route/i);
  });
});

// ---------------------------------------------------------------------------
// Dedup round-trip via GET — verifies file contents match what we POSTed.
// ---------------------------------------------------------------------------

describe('round-trip integrity', () => {
  it('GET dataBase64 decodes to the same bytes POSTed', async () => {
    const saved = await postModel({ name: 'RoundTrip' });
    const uuid = saved.body.data.uuid;

    const fetched = await (await fetch(`${baseUrl}/api/models/${uuid}`)).json();
    const decoded = Buffer.from(fetched.data.dataBase64, 'base64').toString('utf8');
    expect(decoded).toBe('hello');
  });

  it('saving with extractedBundle persists the promoted fields on disk', async () => {
    const saved = await postModel({
      name: 'WithMeta',
      sha256: 'persist-me',
      polyBucket: 'mid',
      isHumanoid: true,
      humanoidBones: ['hips', 'spine'],
      extractedMetadata: { schemaVersion: 1, extractorVersion: '1.0.0' } as any,
    });
    const uuid = saved.body.data.uuid;

    const fetched = await (await fetch(`${baseUrl}/api/models/${uuid}`)).json();
    expect(fetched.data.sha256).toBe('persist-me');
    expect(fetched.data.polyBucket).toBe('mid');
    expect(fetched.data.isHumanoid).toBe(true);
    expect(fetched.data.humanoidBones).toEqual(['hips', 'spine']);
  });
});
