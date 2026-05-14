/**
 * useCameraPresets — load / save / apply / delete user-named camera
 * positions persisted via PreferencesService under the `cameraPresets` key.
 *
 * PreferencesService is mocked at the module level so tests don't need a
 * real Dexie connection. cameraManager is mocked because it requires a
 * live WebGL context.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const prefsMock = vi.hoisted(() => ({
  getPreference: vi.fn(),
  setPreference: vi.fn(),
}));

vi.mock('../core/database/services/PreferencesService', () => ({
  getPreferencesService: () => prefsMock,
}));

const cameraMock = vi.hoisted(() => ({
  camera: {
    position: { x: 1, y: 2, z: 3, set: vi.fn() },
    zoom: 1,
    updateProjectionMatrix: vi.fn(),
  },
  controls: {
    target: { x: 0, y: 1, z: 0, set: vi.fn() },
    update: vi.fn(),
  },
  getCamera: vi.fn(),
  getControls: vi.fn(),
}));

vi.mock('../core/three/scene/CameraManager', () => ({
  cameraManager: {
    getCamera: () => cameraMock.camera,
    getControls: () => cameraMock.controls,
  },
}));

import {
  useCameraPresets,
  resolveCameraPreset,
  applyCameraSnapshot,
  BUILTIN_PRESET_NAMES,
  type CameraPresetSnapshot,
} from './useCameraPresets';

function snapshot(overrides: Partial<CameraPresetSnapshot> = {}): CameraPresetSnapshot {
  return {
    position: { x: 1, y: 2, z: 3 },
    target: { x: 0, y: 1, z: 0 },
    zoom: 1,
    ...overrides,
  };
}

beforeEach(() => {
  prefsMock.getPreference.mockReset().mockResolvedValue({ success: true, data: undefined });
  prefsMock.setPreference.mockReset().mockResolvedValue({ success: true });
  cameraMock.camera.position.set.mockReset();
  cameraMock.camera.updateProjectionMatrix.mockReset();
  cameraMock.controls.target.set.mockReset();
  cameraMock.controls.update.mockReset();
  cameraMock.camera.position.x = 1;
  cameraMock.camera.position.y = 2;
  cameraMock.camera.position.z = 3;
  cameraMock.controls.target.x = 0;
  cameraMock.controls.target.y = 1;
  cameraMock.controls.target.z = 0;
  cameraMock.camera.zoom = 1;
});

describe('useCameraPresets — load', () => {
  it('starts with empty map and isLoaded=false', () => {
    // Block the load so we can observe the pre-resolution state.
    prefsMock.getPreference.mockReturnValueOnce(new Promise(() => {}));
    const { result } = renderHook(() => useCameraPresets());
    expect(result.current.presets).toEqual({});
    expect(result.current.isLoaded).toBe(false);
  });

  it('hydrates from preferences once on mount', async () => {
    prefsMock.getPreference.mockResolvedValueOnce({
      success: true,
      data: { hero: snapshot(), wide: snapshot({ position: { x: 5, y: 5, z: 5 } }) },
    });

    const { result } = renderHook(() => useCameraPresets());

    await waitFor(() => {
      expect(result.current.isLoaded).toBe(true);
    });

    expect(Object.keys(result.current.presets).sort()).toEqual(['hero', 'wide']);
  });

  it('falls through to isLoaded=true when load fails (does not throw)', async () => {
    prefsMock.getPreference.mockRejectedValueOnce(new Error('db down'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { result } = renderHook(() => useCameraPresets());

    await waitFor(() => {
      expect(result.current.isLoaded).toBe(true);
    });

    expect(result.current.presets).toEqual({});
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('useCameraPresets — savePreset', () => {
  async function readyHook() {
    const hook = renderHook(() => useCameraPresets());
    await waitFor(() => expect(hook.result.current.isLoaded).toBe(true));
    return hook;
  }

  it('captures live camera state under the trimmed name', async () => {
    const { result } = await readyHook();
    let ok = false;
    await act(async () => {
      ok = await result.current.savePreset('  hero  ');
    });
    expect(ok).toBe(true);
    expect(result.current.presets.hero).toBeDefined();
    expect(result.current.presets.hero.position).toEqual({ x: 1, y: 2, z: 3 });
    expect(prefsMock.setPreference).toHaveBeenCalledWith(
      'cameraPresets',
      expect.objectContaining({ hero: expect.any(Object) }),
    );
  });

  it('rejects empty / whitespace-only name', async () => {
    const { result } = await readyHook();
    let ok = true;
    await act(async () => {
      ok = await result.current.savePreset('   ');
    });
    expect(ok).toBe(false);
    expect(prefsMock.setPreference).not.toHaveBeenCalled();
  });

  it('rejects reserved built-in names (case-insensitive)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { result } = await readyHook();

    for (const name of ['front', 'FRONT', 'side', 'top', 'default', 'back']) {
      let ok = true;
      await act(async () => {
        ok = await result.current.savePreset(name);
      });
      expect(ok).toBe(false);
    }
    expect(prefsMock.setPreference).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('returns false + does not mutate state when persistence throws', async () => {
    prefsMock.setPreference.mockRejectedValueOnce(new Error('quota'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { result } = await readyHook();
    let ok = true;
    await act(async () => {
      ok = await result.current.savePreset('hero');
    });

    expect(ok).toBe(false);
    expect(result.current.presets.hero).toBeUndefined();
    warn.mockRestore();
  });
});

describe('useCameraPresets — applyPreset / deletePreset', () => {
  async function readyHookWith(map: Record<string, CameraPresetSnapshot>) {
    prefsMock.getPreference.mockResolvedValueOnce({ success: true, data: map });
    const hook = renderHook(() => useCameraPresets());
    await waitFor(() => expect(hook.result.current.isLoaded).toBe(true));
    return hook;
  }

  it('applyPreset writes through to cameraManager + returns true', async () => {
    const { result } = await readyHookWith({
      hero: snapshot({ position: { x: 9, y: 8, z: 7 } }),
    });

    let applied = false;
    act(() => {
      applied = result.current.applyPreset('hero');
    });

    expect(applied).toBe(true);
    expect(cameraMock.camera.position.set).toHaveBeenCalledWith(9, 8, 7);
    expect(cameraMock.controls.update).toHaveBeenCalled();
  });

  it('applyPreset returns false when the name is not in the map', async () => {
    const { result } = await readyHookWith({});
    let applied = true;
    act(() => {
      applied = result.current.applyPreset('does-not-exist');
    });
    expect(applied).toBe(false);
    expect(cameraMock.camera.position.set).not.toHaveBeenCalled();
  });

  it('deletePreset removes the entry and persists', async () => {
    const { result } = await readyHookWith({
      hero: snapshot(),
      wide: snapshot(),
    });

    await act(async () => {
      await result.current.deletePreset('hero');
    });

    expect(Object.keys(result.current.presets)).toEqual(['wide']);
    expect(prefsMock.setPreference).toHaveBeenCalledWith(
      'cameraPresets',
      { wide: expect.any(Object) },
    );
  });
});

// ---------------------------------------------------------------------------
// applyCameraSnapshot — exported helper used by DAM URL resolution
// ---------------------------------------------------------------------------

describe('applyCameraSnapshot', () => {
  it('writes position + target + zoom and calls update', () => {
    const ok = applyCameraSnapshot(snapshot({ zoom: 1.5 }));
    expect(ok).toBe(true);
    expect(cameraMock.camera.position.set).toHaveBeenCalledWith(1, 2, 3);
    expect(cameraMock.controls.target.set).toHaveBeenCalledWith(0, 1, 0);
    expect(cameraMock.camera.zoom).toBe(1.5);
    expect(cameraMock.camera.updateProjectionMatrix).toHaveBeenCalled();
    expect(cameraMock.controls.update).toHaveBeenCalled();
  });

  it('skips zoom write when snapshot.zoom is NaN', () => {
    const before = cameraMock.camera.zoom;
    applyCameraSnapshot(snapshot({ zoom: Number.NaN as unknown as number }));
    expect(cameraMock.camera.zoom).toBe(before);
    expect(cameraMock.camera.updateProjectionMatrix).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// resolveCameraPreset — DAM-side resolution combining built-ins + user
// ---------------------------------------------------------------------------

describe('resolveCameraPreset', () => {
  // resolveCameraPreset uses cameraManager.setCameraPosition / resetCamera
  // which aren't on our mock — verify via the user-preset path + ensure
  // the built-in branches return true without throwing.
  it('returns true for built-in preset:front (uses setCameraPosition)', async () => {
    // Override the mock to include the setters resolveCameraPreset needs.
    const setCameraPosition = vi.fn();
    const resetCamera = vi.fn();
    const original = await import('../core/three/scene/CameraManager');
    (original.cameraManager as any).setCameraPosition = setCameraPosition;
    (original.cameraManager as any).resetCamera = resetCamera;

    const ok = await resolveCameraPreset('front');
    expect(ok).toBe(true);
    expect(setCameraPosition).toHaveBeenCalled();
  });

  it('matches user-saved preset by exact name (not lowercased)', async () => {
    prefsMock.getPreference.mockResolvedValueOnce({
      success: true,
      data: { 'My Custom Hero Shot': snapshot({ position: { x: 7, y: 7, z: 7 } }) },
    });

    const ok = await resolveCameraPreset('My Custom Hero Shot');
    expect(ok).toBe(true);
    expect(cameraMock.camera.position.set).toHaveBeenCalledWith(7, 7, 7);
  });

  it('returns false when the name is not a built-in and no user preset matches', async () => {
    prefsMock.getPreference.mockResolvedValueOnce({ success: true, data: {} });
    const ok = await resolveCameraPreset('not-a-real-preset');
    // resolveCameraPreset hits the built-in switch's default branch which
    // resets — but since the name isn't a built-in, the BUILTIN_PRESET_NAMES
    // check fails and we fall through to the user-preset map. Empty map
    // means "not found" → false.
    expect(ok).toBe(false);
  });
});

describe('BUILTIN_PRESET_NAMES', () => {
  it('includes all the documented reserved names', () => {
    expect(BUILTIN_PRESET_NAMES.has('front')).toBe(true);
    expect(BUILTIN_PRESET_NAMES.has('side')).toBe(true);
    expect(BUILTIN_PRESET_NAMES.has('top')).toBe(true);
    expect(BUILTIN_PRESET_NAMES.has('default')).toBe(true);
    expect(BUILTIN_PRESET_NAMES.has('back')).toBe(true);
  });
});
