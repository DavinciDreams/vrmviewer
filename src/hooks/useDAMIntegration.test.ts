/**
 * useDAMIntegration — the URL-query-driven embedding hook.
 *
 * The hook has the largest collaborator surface of any in the project:
 *   - useModel, usePlayback, useAnimation (three sibling hooks)
 *   - cameraManager + lightingManager singletons (Three.js side)
 *   - window.location.search (URL parsing)
 *   - global fetch (animation download)
 *
 * Everything is mocked at the module level. Tests target the pure-logic
 * branches: URL validation, preset-name → coords mapping, background
 * colour parsing (hex / rgb / named / invalid), lighting preset table,
 * playback config application, and the mount-time auto-load path.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Module mocks — hoisted so they install before useDAMIntegration imports.
// ---------------------------------------------------------------------------

const useModelMock = vi.hoisted(() => ({
  loadFromURL: vi.fn(),
  clearCurrentModel: vi.fn(),
}));
const usePlaybackMock = vi.hoisted(() => ({
  play: vi.fn(),
  pause: vi.fn(),
  setSpeed: vi.fn(),
  toggleLoop: vi.fn(),
}));
const useAnimationMock = vi.hoisted(() => ({
  loadFromFile: vi.fn(),
  play: vi.fn(),
  pause: vi.fn(),
}));

vi.mock('./useModel', () => ({
  useModel: () => useModelMock,
}));
vi.mock('./usePlayback', () => ({
  usePlayback: () => usePlaybackMock,
}));
vi.mock('./useAnimation', () => ({
  useAnimation: () => useAnimationMock,
}));

const cameraMgr = vi.hoisted(() => ({
  setCameraPosition: vi.fn(),
  resetCamera: vi.fn(),
  getRenderer: vi.fn(() => ({ setClearColor: vi.fn() })),
}));
const lightingMgr = vi.hoisted(() => ({
  setAmbientIntensity: vi.fn(),
  setDirectionalIntensity: vi.fn(),
}));

vi.mock('../core/three/scene/CameraManager', () => ({
  cameraManager: cameraMgr,
}));
vi.mock('../core/three/scene/LightingManager', () => ({
  lightingManager: lightingMgr,
}));

// Import after mocks.
import { useDAMIntegration } from './useDAMIntegration';
import { usePlaybackStore } from '../store/playbackStore';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setURLSearch(search: string): void {
  // Reassign window.location.search via a getter — jsdom's
  // window.location is non-writable but we can shadow it on the
  // existing instance via Object.defineProperty.
  Object.defineProperty(window, 'location', {
    writable: true,
    configurable: true,
    value: { ...window.location, search },
  });
}

function clearMocks(): void {
  useModelMock.loadFromURL.mockReset().mockResolvedValue(undefined);
  useModelMock.clearCurrentModel.mockReset();
  usePlaybackMock.play.mockReset();
  usePlaybackMock.pause.mockReset();
  usePlaybackMock.setSpeed.mockReset();
  usePlaybackMock.toggleLoop.mockReset();
  useAnimationMock.loadFromFile.mockReset();
  useAnimationMock.play.mockReset();
  useAnimationMock.pause.mockReset();
  cameraMgr.setCameraPosition.mockReset();
  cameraMgr.resetCamera.mockReset();
  cameraMgr.getRenderer.mockReset().mockReturnValue({ setClearColor: vi.fn() });
  lightingMgr.setAmbientIntensity.mockReset();
  lightingMgr.setDirectionalIntensity.mockReset();
}

beforeEach(() => {
  setURLSearch('');
  clearMocks();
  // playbackStore.loop default is true (verified in usePlayback tests).
  act(() => {
    usePlaybackStore.getState().setLoop(true);
  });
});

afterEach(() => {
  setURLSearch('');
});

// ---------------------------------------------------------------------------
// loadModelFromURL — URL validation
// ---------------------------------------------------------------------------

describe('loadModelFromURL', () => {
  it('rejects an invalid URL with the documented error message', async () => {
    const { result } = renderHook(() => useDAMIntegration());
    await act(async () => {
      await result.current.loadModelFromURL('not-a-url');
    });

    expect(result.current.loadingState.error).toMatch(/invalid model url/i);
    expect(useModelMock.loadFromURL).not.toHaveBeenCalled();
  });

  it('rejects a non-http(s) URL (e.g. ftp://)', async () => {
    const { result } = renderHook(() => useDAMIntegration());
    await act(async () => {
      await result.current.loadModelFromURL('ftp://x/model.vrm');
    });

    expect(result.current.loadingState.error).toMatch(/invalid model url/i);
    expect(useModelMock.loadFromURL).not.toHaveBeenCalled();
  });

  it('calls useModel.loadFromURL on success + flips modelLoaded', async () => {
    useModelMock.loadFromURL.mockResolvedValueOnce({});

    const { result } = renderHook(() => useDAMIntegration());
    await act(async () => {
      await result.current.loadModelFromURL('https://x/model.vrm');
    });

    expect(useModelMock.loadFromURL).toHaveBeenCalledWith('https://x/model.vrm');
    expect(result.current.loadingState.modelLoaded).toBe(true);
    expect(result.current.loadingState.isLoading).toBe(false);
    expect(result.current.loadingState.error).toBeNull();
  });

  it('surfaces loader throw into loadingState.error', async () => {
    useModelMock.loadFromURL.mockRejectedValueOnce(new Error('parse failed'));

    const { result } = renderHook(() => useDAMIntegration());
    await act(async () => {
      await result.current.loadModelFromURL('https://x/model.vrm');
    });

    expect(result.current.loadingState.error).toBe('parse failed');
    expect(result.current.loadingState.isLoading).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// loadAnimationFromURL — URL validation + fetch
// ---------------------------------------------------------------------------

describe('loadAnimationFromURL', () => {
  it('rejects an invalid URL', async () => {
    const { result } = renderHook(() => useDAMIntegration());
    await act(async () => {
      await result.current.loadAnimationFromURL('not-a-url');
    });

    expect(result.current.loadingState.error).toMatch(/invalid animation url/i);
  });

  it('fetches the URL, wraps in File, calls useAnimation.loadFromFile', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      blob: () => Promise.resolve(new Blob(['data'])),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    useAnimationMock.loadFromFile.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useDAMIntegration());
    await act(async () => {
      await result.current.loadAnimationFromURL('https://x/walk.vrma');
    });

    expect(fetchMock).toHaveBeenCalledWith('https://x/walk.vrma');
    expect(useAnimationMock.loadFromFile).toHaveBeenCalled();
    const file = useAnimationMock.loadFromFile.mock.calls[0][0] as File;
    expect(file.name).toBe('animation.vrma');
    expect(result.current.loadingState.animationLoaded).toBe(true);
  });

  it('surfaces fetch failure into loadingState.error', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      statusText: 'Not Found',
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useDAMIntegration());
    await act(async () => {
      await result.current.loadAnimationFromURL('https://x/missing.vrma');
    });

    expect(result.current.loadingState.error).toMatch(/Not Found/);
    expect(useAnimationMock.loadFromFile).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// loadFromConfig — orchestration + side-effect application
// ---------------------------------------------------------------------------

describe('loadFromConfig — camera presets', () => {
  it('preset:front → setCameraPosition (0, 1.5, 3)', async () => {
    const { result } = renderHook(() => useDAMIntegration());
    await act(async () => {
      await result.current.loadFromConfig({ camera: 'preset:front' });
    });

    expect(cameraMgr.setCameraPosition).toHaveBeenCalledTimes(1);
    const pos = cameraMgr.setCameraPosition.mock.calls[0][0] as any;
    expect([pos.x, pos.y, pos.z]).toEqual([0, 1.5, 3]);
  });

  it('preset:side → (3, 1.5, 0)', async () => {
    const { result } = renderHook(() => useDAMIntegration());
    await act(async () => {
      await result.current.loadFromConfig({ camera: 'preset:side' });
    });
    const pos = cameraMgr.setCameraPosition.mock.calls[0][0] as any;
    expect([pos.x, pos.y, pos.z]).toEqual([3, 1.5, 0]);
  });

  it('preset:top → (0, 4, 2)', async () => {
    const { result } = renderHook(() => useDAMIntegration());
    await act(async () => {
      await result.current.loadFromConfig({ camera: 'preset:top' });
    });
    const pos = cameraMgr.setCameraPosition.mock.calls[0][0] as any;
    expect([pos.x, pos.y, pos.z]).toEqual([0, 4, 2]);
  });

  it('preset:default → resetCamera()', async () => {
    const { result } = renderHook(() => useDAMIntegration());
    await act(async () => {
      await result.current.loadFromConfig({ camera: 'preset:default' });
    });
    expect(cameraMgr.resetCamera).toHaveBeenCalled();
  });

  it('comma-separated triple → setCameraPosition with parsed coords', async () => {
    const { result } = renderHook(() => useDAMIntegration());
    await act(async () => {
      await result.current.loadFromConfig({ camera: '1.5,2,3' });
    });
    const pos = cameraMgr.setCameraPosition.mock.calls[0][0] as any;
    expect([pos.x, pos.y, pos.z]).toEqual([1.5, 2, 3]);
  });

  it('malformed coord triple is ignored (no call)', async () => {
    const { result } = renderHook(() => useDAMIntegration());
    await act(async () => {
      await result.current.loadFromConfig({ camera: '1,not-a-number,3' });
    });
    expect(cameraMgr.setCameraPosition).not.toHaveBeenCalled();
    expect(cameraMgr.resetCamera).not.toHaveBeenCalled();
  });
});

describe('loadFromConfig — background colour', () => {
  it('hex colour with # prefix is applied', async () => {
    const setClearColor = vi.fn();
    cameraMgr.getRenderer.mockReturnValue({ setClearColor });

    const { result } = renderHook(() => useDAMIntegration());
    await act(async () => {
      await result.current.loadFromConfig({ background: '#1a1a2e' });
    });
    expect(setClearColor).toHaveBeenCalled();
  });

  it('hex colour without # prefix is applied', async () => {
    const setClearColor = vi.fn();
    cameraMgr.getRenderer.mockReturnValue({ setClearColor });

    const { result } = renderHook(() => useDAMIntegration());
    await act(async () => {
      await result.current.loadFromConfig({ background: 'ff00ff' });
    });
    expect(setClearColor).toHaveBeenCalled();
  });

  it('rgb triple is applied', async () => {
    const setClearColor = vi.fn();
    cameraMgr.getRenderer.mockReturnValue({ setClearColor });

    const { result } = renderHook(() => useDAMIntegration());
    await act(async () => {
      await result.current.loadFromConfig({ background: '26, 26, 46' });
    });
    expect(setClearColor).toHaveBeenCalled();
  });

  it('out-of-range rgb values are silently rejected (no setClearColor call)', async () => {
    // RGB_PATTERN matches (each part is 1-3 digits), but the 0..255 range
    // check fails — color stays null and setClearColor is never called.
    // No console.warn: warn fires only in the unrecognised-string else
    // branch, not for this in-pattern-but-out-of-range case.
    const setClearColor = vi.fn();
    cameraMgr.getRenderer.mockReturnValue({ setClearColor });

    const { result } = renderHook(() => useDAMIntegration());
    await act(async () => {
      await result.current.loadFromConfig({ background: '999,999,999' });
    });
    expect(setClearColor).not.toHaveBeenCalled();
  });

  it('allow-listed named colour is applied', async () => {
    const setClearColor = vi.fn();
    cameraMgr.getRenderer.mockReturnValue({ setClearColor });

    const { result } = renderHook(() => useDAMIntegration());
    await act(async () => {
      await result.current.loadFromConfig({ background: 'red' });
    });
    expect(setClearColor).toHaveBeenCalled();
  });

  it('unrecognised colour name is rejected with a warning (no call)', async () => {
    const setClearColor = vi.fn();
    cameraMgr.getRenderer.mockReturnValue({ setClearColor });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { result } = renderHook(() => useDAMIntegration());
    await act(async () => {
      await result.current.loadFromConfig({ background: 'fuchsiagibberish' });
    });
    expect(setClearColor).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('loadFromConfig — lighting presets', () => {
  it.each([
    ['soft', 0.7, 0.6],
    ['studio', 0.5, 1.5],
    ['dim', 0.2, 0.4],
    ['bright', 1.0, 1.5],
    ['flat', 1.2, 0.2],
    ['default', 0.6, 0.8],
  ] as const)(
    '"%s" maps to ambient=%f, directional=%f',
    async (preset, ambient, directional) => {
      const { result } = renderHook(() => useDAMIntegration());
      await act(async () => {
        await result.current.loadFromConfig({ lighting: preset });
      });

      expect(lightingMgr.setAmbientIntensity).toHaveBeenCalledWith(ambient);
      expect(lightingMgr.setDirectionalIntensity).toHaveBeenCalledWith(directional);
    },
  );

  it('unrecognised preset is ignored', async () => {
    const { result } = renderHook(() => useDAMIntegration());
    await act(async () => {
      await result.current.loadFromConfig({ lighting: 'gibberish' });
    });
    expect(lightingMgr.setAmbientIntensity).not.toHaveBeenCalled();
  });

  it('preset name is case-insensitive', async () => {
    const { result } = renderHook(() => useDAMIntegration());
    await act(async () => {
      await result.current.loadFromConfig({ lighting: 'STUDIO' });
    });
    expect(lightingMgr.setAmbientIntensity).toHaveBeenCalledWith(0.5);
  });
});

describe('loadFromConfig — playback', () => {
  it('autoplay=true → play() + animation.play()', async () => {
    const { result } = renderHook(() => useDAMIntegration());
    await act(async () => {
      await result.current.loadFromConfig({ autoplay: true });
    });

    expect(usePlaybackMock.play).toHaveBeenCalled();
    expect(useAnimationMock.play).toHaveBeenCalled();
  });

  it('autoplay=false → pause() + animation.pause()', async () => {
    const { result } = renderHook(() => useDAMIntegration());
    await act(async () => {
      await result.current.loadFromConfig({ autoplay: false });
    });

    expect(usePlaybackMock.pause).toHaveBeenCalled();
    expect(useAnimationMock.pause).toHaveBeenCalled();
  });

  it('speed is forwarded to setSpeed when defined', async () => {
    const { result } = renderHook(() => useDAMIntegration());
    await act(async () => {
      await result.current.loadFromConfig({ speed: 2 });
    });
    expect(usePlaybackMock.setSpeed).toHaveBeenCalledWith(2);
  });

  it('loop=false toggles when store state is currently true', async () => {
    // Default playback store.loop is true.
    const { result } = renderHook(() => useDAMIntegration());
    await act(async () => {
      await result.current.loadFromConfig({ loop: false });
    });
    expect(usePlaybackMock.toggleLoop).toHaveBeenCalled();
  });

  it('loop=true does NOT toggle when store state is already true', async () => {
    const { result } = renderHook(() => useDAMIntegration());
    await act(async () => {
      await result.current.loadFromConfig({ loop: true });
    });
    expect(usePlaybackMock.toggleLoop).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// clearDAMState
// ---------------------------------------------------------------------------

describe('clearDAMState', () => {
  it('resets loadingState and config', async () => {
    useModelMock.loadFromURL.mockResolvedValueOnce({});

    const { result } = renderHook(() => useDAMIntegration());
    await act(async () => {
      await result.current.loadModelFromURL('https://x/m.vrm');
    });
    expect(result.current.loadingState.modelLoaded).toBe(true);

    act(() => {
      result.current.clearDAMState();
    });

    expect(result.current.loadingState).toEqual({
      isLoading: false,
      error: null,
      modelLoaded: false,
      animationLoaded: false,
    });
    expect(result.current.config).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// Mount-time auto-load from URL params
// ---------------------------------------------------------------------------

describe('mount-time URL parsing + auto-load', () => {
  it('parses query params and auto-loads when ?model= is set', async () => {
    useModelMock.loadFromURL.mockResolvedValueOnce({});
    setURLSearch('?model=https://x/auto.vrm&autoplay=true&loop=false');

    renderHook(() => useDAMIntegration());

    await waitFor(() => {
      expect(useModelMock.loadFromURL).toHaveBeenCalledWith('https://x/auto.vrm');
    });
  });

  it('does NOT auto-load when ?model= is absent', async () => {
    setURLSearch('?autoplay=true');

    renderHook(() => useDAMIntegration());

    // Give the effect a tick — model should never load.
    await new Promise((r) => setTimeout(r, 10));
    expect(useModelMock.loadFromURL).not.toHaveBeenCalled();
  });

  it('parses autoplay=true / loop=true / wireframe=true correctly', () => {
    setURLSearch('?autoplay=true&loop=true&wireframe=true&visible=false');

    const { result } = renderHook(() => useDAMIntegration());

    expect(result.current.config.autoplay).toBe(true);
    expect(result.current.config.loop).toBe(true);
    expect(result.current.config.wireframe).toBe(true);
    expect(result.current.config.visible).toBe(false);
  });

  it('parses speed as a float', () => {
    setURLSearch('?speed=1.5');
    const { result } = renderHook(() => useDAMIntegration());
    expect(result.current.config.speed).toBe(1.5);
  });
});
