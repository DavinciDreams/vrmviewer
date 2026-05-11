/**
 * Metadata Pipeline Tests
 */

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { extractGeometry } from './extractGeometry';
import { extractRig } from './extractRig';
import { sha256 } from './extractHashes';
import { normalizeLicense } from './normalizeLicense';
import { tokenize } from './tokenize';

// ---------------------------------------------------------------------------
// extractGeometry
// ---------------------------------------------------------------------------

describe('extractGeometry', () => {
  it('returns all-zero result for an empty Group', () => {
    const scene = new THREE.Group();
    const result = extractGeometry(scene);
    expect(result.triangleCount).toBe(0);
    expect(result.vertexCount).toBe(0);
    expect(result.meshCount).toBe(0);
    expect(result.height).toBe(0);
    expect(result.polyBucket).toBe('low');
    expect(result.boundingBox.min).toEqual([0, 0, 0]);
    expect(result.boundingBox.max).toEqual([0, 0, 0]);
  });

  it('counts triangles from an indexed BufferGeometry correctly', () => {
    const geo = new THREE.BufferGeometry();
    // 4 vertices forming a quad (2 triangles = 6 indices)
    const positions = new Float32Array([
      0, 0, 0,
      1, 0, 0,
      1, 1, 0,
      0, 1, 0,
    ]);
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setIndex([0, 1, 2, 0, 2, 3]);

    const mesh = new THREE.Mesh(geo);
    const scene = new THREE.Group();
    scene.add(mesh);

    const result = extractGeometry(scene);
    expect(result.meshCount).toBe(1);
    expect(result.triangleCount).toBe(2); // 6 indices / 3
    expect(result.vertexCount).toBe(4);
  });

  it('counts triangles from non-indexed geometry', () => {
    const geo = new THREE.BufferGeometry();
    // 6 vertices = 2 triangles
    const positions = new Float32Array(6 * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const mesh = new THREE.Mesh(geo);
    const scene = new THREE.Group();
    scene.add(mesh);

    const result = extractGeometry(scene);
    expect(result.triangleCount).toBe(2);
    expect(result.vertexCount).toBe(6);
  });

  it('classifies polyBucket correctly', () => {
    // Build a scene with just enough triangles for 'mid' (>= 10k, < 50k)
    const geo = new THREE.BufferGeometry();
    const count = 11_000 * 3; // 11k triangles non-indexed
    const positions = new Float32Array(count * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mesh = new THREE.Mesh(geo);
    const scene = new THREE.Group();
    scene.add(mesh);
    expect(extractGeometry(scene).polyBucket).toBe('mid');
  });
});

// ---------------------------------------------------------------------------
// extractRig
// ---------------------------------------------------------------------------

describe('extractRig', () => {
  it('counts bones in scene', () => {
    const scene = new THREE.Group();
    const bone1 = new THREE.Bone();
    const bone2 = new THREE.Bone();
    scene.add(bone1);
    scene.add(bone2);

    const result = extractRig(scene);
    expect(result.boneCount).toBe(2);
    expect(result.isHumanoid).toBe(false);
    expect(result.humanoidBonesPresent).toEqual([]);
  });

  it('returns zero rig for empty scene without VRM', () => {
    const scene = new THREE.Group();
    const result = extractRig(scene);
    expect(result.boneCount).toBe(0);
    expect(result.blendShapeCount).toBe(0);
    expect(result.expressionCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// tokenize
// ---------------------------------------------------------------------------

describe('tokenize', () => {
  it('splits CamelCase and lowercases', () => {
    const tokens = tokenize({ name: 'walkAnimationFast' });
    expect(tokens).toContain('walk');
    expect(tokens).toContain('animation');
    expect(tokens).toContain('fast');
  });

  it('includes tags and deduplicates', () => {
    const tokens = tokenize({ name: 'idle', tags: ['idle', 'breathing'] });
    const idleCount = tokens.filter((t) => t === 'idle').length;
    expect(idleCount).toBe(1);
    expect(tokens).toContain('breathing');
  });

  it('drops tokens shorter than 2 characters', () => {
    const tokens = tokenize({ name: 'a bb ccc' });
    expect(tokens).not.toContain('a');
    expect(tokens).toContain('bb');
    expect(tokens).toContain('ccc');
  });

  it('caps output at 100 tokens', () => {
    const longDesc = Array.from({ length: 200 }, (_, i) => `word${i}`).join(' ');
    const tokens = tokenize({ description: longDesc });
    expect(tokens.length).toBeLessThanOrEqual(100);
  });

  it('handles full combined input', () => {
    const tokens = tokenize({
      name: 'walkAnimationFast',
      tags: ['idle', 'breathing'],
    });
    expect(tokens).toContain('walk');
    expect(tokens).toContain('idle');
    expect(tokens).toContain('breathing');
  });
});

// ---------------------------------------------------------------------------
// sha256
// ---------------------------------------------------------------------------

describe('sha256', () => {
  it('produces known digest for "hello"', async () => {
    const buffer = new TextEncoder().encode('hello').buffer as ArrayBuffer;
    const digest = await sha256(buffer);
    expect(digest).toBe(
      '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824'
    );
  });

  it('returns a 64-character hex string', async () => {
    const buffer = new TextEncoder().encode('test').buffer as ArrayBuffer;
    const digest = await sha256(buffer);
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
  });
});

// ---------------------------------------------------------------------------
// normalizeLicense
// ---------------------------------------------------------------------------

describe('normalizeLicense', () => {
  it('returns empty object for undefined VRM', () => {
    const result = normalizeLicense(undefined, 'fbx');
    expect(result).toEqual({});
  });

  it('returns empty object for VRM with no meta', () => {
    // Minimal stub with empty meta
    const fakeVrm = { meta: {} } as never;
    const result = normalizeLicense(fakeVrm, 'vrm');
    expect(result).toEqual({});
  });

  it('reads VRM 0.x license fields', () => {
    const fakeVrm = {
      meta: {
        allowedUserName: 'Everyone',
        commercialUssageName: 'Allow',
        violentUssageName: 'Disallow',
        licenseName: 'CC_BY',
      },
    } as never;
    const result = normalizeLicense(fakeVrm, 'vrm');
    expect(result.allowedUserName).toBe('Everyone');
    expect(result.commercialUsage).toBe('Allow');
    expect(result.violentUsage).toBe('Disallow');
    expect(result.licenseName).toBe('CC_BY');
  });

  it('reads VRM 1.0 license fields', () => {
    const fakeVrm = {
      meta: {
        commercialUsage: 'PersonalProfit',
        allowExcessivelyViolentUsage: false,
        allowExcessivelySexualUsage: true,
        modification: 'AllowModification',
        licenseUrl: 'https://vrm.dev/licenses/1.0/',
      },
    } as never;
    const result = normalizeLicense(fakeVrm, 'vrm');
    expect(result.commercialUsage).toBe('PersonalProfit');
    expect(result.violentUsage).toBe('Disallow');
    expect(result.sexualUsage).toBe('Allow');
    expect(result.modification).toBe('AllowModification');
    expect(result.licenseUrl).toBe('https://vrm.dev/licenses/1.0/');
  });
});
