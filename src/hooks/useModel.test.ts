/**
 * useModel — format-agnostic model loading hook.
 *
 * The hook dispatches to one of three loaders based on filename/URL
 * extension: gltfLoaderEnhanced (glb/gltf), vrmLoader (vrm), fbxLoader (fbx).
 * Each loader is mocked via vi.hoisted + vi.mock; useModelStore is real and
 * reset in beforeEach.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const loaders = vi.hoisted(() => ({
  gltf: {
    loadFromURL: vi.fn(),
    loadFromFile: vi.fn(),
  },
  vrm: {
    loadFromURL: vi.fn(),
    loadFromFile: vi.fn(),
  },
  fbx: {
    loadFromURL: vi.fn(),
    loadFromFile: vi.fn(),
  },
}));

vi.mock('../core/three/loaders/GLTFLoaderEnhanced', () => ({
  gltfLoaderEnhanced: loaders.gltf,
}));
vi.mock('../core/three/loaders/VRMLoader', () => ({
  vrmLoader: loaders.vrm,
}));
vi.mock('../core/three/loaders/FBXLoader', () => ({
  fbxLoader: loaders.fbx,
}));

// fileUtils.validateModelFile is invoked for the file path. Default to a
// pass-through that always validates; individual tests override.
const fileUtilsMocks = vi.hoisted(() => ({
  validateModelFile: vi.fn().mockReturnValue({ valid: true }),
}));
vi.mock('../utils/fileUtils', () => fileUtilsMocks);

// Imports after mocks.
import { useModel, isVRMModel } from './useModel';
import { useModelStore } from '../store/modelStore';

function makeModel(format: 'vrm' | 'glb' | 'gltf' | 'fbx', extra: any = {}) {
  return {
    format,
    metadata: { name: `m-${format}`, version: '1', author: 'a' },
    ...extra,
  };
}

beforeEach(() => {
  for (const ldr of Object.values(loaders)) {
    ldr.loadFromURL.mockReset();
    ldr.loadFromFile.mockReset();
  }
  fileUtilsMocks.validateModelFile.mockReset();
  fileUtilsMocks.validateModelFile.mockReturnValue({ valid: true });
  act(() => {
    useModelStore.getState().clearModel();
    useModelStore.getState().setLoading(false);
  });
});

describe('useModel — initial state', () => {
  it('exposes nulls + isLoading=false + no format helpers', () => {
    const { result } = renderHook(() => useModel());
    expect(result.current.currentModel).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.metadata).toBeNull();
    expect(result.current.format).toBeUndefined();
    expect(result.current.isVRM).toBe(false);
    expect(result.current.isGLB).toBe(false);
    expect(result.current.isGLTF).toBe(false);
    expect(result.current.isFBX).toBe(false);
    expect(result.current.hasSkeleton).toBe(false);
    expect(result.current.hasMorphTargets).toBe(false);
    expect(result.current.hasAnimations).toBe(false);
  });
});

describe('useModel — loadFromURL (format dispatch)', () => {
  it('dispatches to vrmLoader for .vrm URLs', async () => {
    const model = makeModel('vrm');
    loaders.vrm.loadFromURL.mockResolvedValueOnce({ success: true, data: model });

    const { result } = renderHook(() => useModel());
    await act(async () => {
      await result.current.loadFromURL('https://x/avatar.vrm');
    });

    expect(loaders.vrm.loadFromURL).toHaveBeenCalledWith('https://x/avatar.vrm');
    expect(loaders.gltf.loadFromURL).not.toHaveBeenCalled();
    expect(result.current.currentModel?.format).toBe('vrm');
    expect(result.current.isVRM).toBe(true);
  });

  it('dispatches to gltfLoaderEnhanced for .glb URLs', async () => {
    const model = makeModel('glb');
    loaders.gltf.loadFromURL.mockResolvedValueOnce({ success: true, data: model });

    const { result } = renderHook(() => useModel());
    await act(async () => {
      await result.current.loadFromURL('https://x/scene.glb');
    });

    expect(loaders.gltf.loadFromURL).toHaveBeenCalledWith('https://x/scene.glb');
    expect(result.current.isGLB).toBe(true);
  });

  it('dispatches to gltfLoaderEnhanced for .gltf URLs', async () => {
    const model = makeModel('gltf');
    loaders.gltf.loadFromURL.mockResolvedValueOnce({ success: true, data: model });

    const { result } = renderHook(() => useModel());
    await act(async () => {
      await result.current.loadFromURL('https://x/scene.gltf');
    });

    expect(loaders.gltf.loadFromURL).toHaveBeenCalled();
    expect(result.current.isGLTF).toBe(true);
  });

  it('dispatches to fbxLoader for .fbx URLs', async () => {
    const model = makeModel('fbx');
    loaders.fbx.loadFromURL.mockResolvedValueOnce({ success: true, data: model });

    const { result } = renderHook(() => useModel());
    await act(async () => {
      await result.current.loadFromURL('https://x/anim.fbx');
    });

    expect(loaders.fbx.loadFromURL).toHaveBeenCalled();
    expect(result.current.isFBX).toBe(true);
  });

  it('defaults to gltfLoader for unknown extensions', async () => {
    const model = makeModel('glb');
    loaders.gltf.loadFromURL.mockResolvedValueOnce({ success: true, data: model });

    const { result } = renderHook(() => useModel());
    await act(async () => {
      await result.current.loadFromURL('https://x/no-extension');
    });

    expect(loaders.gltf.loadFromURL).toHaveBeenCalled();
  });

  it('surfaces loader error.message into state.error', async () => {
    loaders.vrm.loadFromURL.mockResolvedValueOnce({
      success: false,
      error: { message: 'broken model' },
    });

    const { result } = renderHook(() => useModel());
    await act(async () => {
      await result.current.loadFromURL('https://x/bad.vrm');
    });

    expect(result.current.currentModel).toBeNull();
    expect(result.current.error).toBe('broken model');
  });

  it('falls back to a generic message when loader error has no message', async () => {
    loaders.vrm.loadFromURL.mockResolvedValueOnce({ success: false, error: {} });

    const { result } = renderHook(() => useModel());
    await act(async () => {
      await result.current.loadFromURL('https://x/bad.vrm');
    });
    expect(result.current.error).toBe('Failed to load model');
  });

  it('catches loader throws and sets the error message', async () => {
    loaders.vrm.loadFromURL.mockRejectedValueOnce(new Error('network down'));

    const { result } = renderHook(() => useModel());
    await act(async () => {
      await result.current.loadFromURL('https://x/x.vrm');
    });
    expect(result.current.error).toBe('network down');
  });
});

describe('useModel — loadFromFile', () => {
  it('rejects invalid files via validateModelFile', async () => {
    fileUtilsMocks.validateModelFile.mockReturnValueOnce({
      valid: false,
      error: 'unsupported',
    });

    const file = new File([new ArrayBuffer(8)], 'x.vrm');
    const { result } = renderHook(() => useModel());
    await act(async () => {
      await result.current.loadFromFile(file);
    });

    expect(result.current.error).toBe('unsupported');
    expect(result.current.currentModel).toBeNull();
    expect(loaders.vrm.loadFromFile).not.toHaveBeenCalled();
  });

  it('dispatches to the right loader based on file extension', async () => {
    const model = makeModel('vrm');
    loaders.vrm.loadFromFile.mockResolvedValueOnce({ success: true, data: model });

    const file = new File([new ArrayBuffer(8)], 'avatar.vrm');
    const { result } = renderHook(() => useModel());
    await act(async () => {
      await result.current.loadFromFile(file);
    });

    expect(loaders.vrm.loadFromFile).toHaveBeenCalledWith(file);
    expect(result.current.currentModel?.format).toBe('vrm');
  });

  it('loadModelFromFile is the same function as loadFromFile (backcompat alias)', () => {
    const { result } = renderHook(() => useModel());
    expect(result.current.loadModelFromFile).toBe(result.current.loadFromFile);
  });

  it('catches loader throws and sets the error message', async () => {
    loaders.vrm.loadFromFile.mockRejectedValueOnce(new Error('parse failed'));

    const file = new File([new ArrayBuffer(8)], 'avatar.vrm');
    const { result } = renderHook(() => useModel());
    await act(async () => {
      await result.current.loadFromFile(file);
    });

    expect(result.current.error).toBe('parse failed');
  });
});

describe('useModel — format helpers', () => {
  it('hasSkeleton / hasMorphTargets / hasAnimations reflect the current model', async () => {
    const model = makeModel('vrm', {
      skeleton: {},
      morphTargets: new Map([['a', {}]]),
      animations: [{ name: 'idle' }],
    });
    loaders.vrm.loadFromURL.mockResolvedValueOnce({ success: true, data: model });

    const { result } = renderHook(() => useModel());
    await act(async () => {
      await result.current.loadFromURL('https://x/m.vrm');
    });

    expect(result.current.hasSkeleton).toBe(true);
    expect(result.current.hasMorphTargets).toBe(true);
    expect(result.current.hasAnimations).toBe(true);
  });

  it('clearCurrentModel resets state', async () => {
    const model = makeModel('vrm');
    loaders.vrm.loadFromURL.mockResolvedValueOnce({ success: true, data: model });

    const { result } = renderHook(() => useModel());
    await act(async () => {
      await result.current.loadFromURL('https://x/m.vrm');
    });
    expect(result.current.currentModel).not.toBeNull();

    act(() => {
      result.current.clearCurrentModel();
    });
    expect(result.current.currentModel).toBeNull();
  });
});

describe('useModel — type guards', () => {
  it('isVRMModel returns true for vrm-format models with a .vrm field', () => {
    expect(isVRMModel(makeModel('vrm', { vrm: {} }) as any)).toBe(true);
    expect(isVRMModel(makeModel('vrm') as any)).toBe(false); // no .vrm
    expect(isVRMModel(makeModel('glb', { vrm: {} }) as any)).toBe(false);
  });
});
