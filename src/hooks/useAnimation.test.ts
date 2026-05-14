/**
 * useAnimation — full coverage of the manager-delegation wiring added in #30.
 *
 * What we mock and why:
 * - `loaderManager`: real implementation requires WebGL / file IO; we replace
 *   it with vi.hoisted stubs that return success/failure shapes that mirror
 *   the real LoaderManagerResult contract.
 * - `AnimationManager`: instead of constructing one (it requires a live VRM),
 *   we inject a hand-rolled stub directly into `animationStore` via
 *   `setAnimationManager(stub)`. The stub records every call so tests can
 *   assert delegation order / arguments.
 *
 * We do NOT mock zustand — `useAnimationStore` is exercised end-to-end.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Module mocks (hoisted so they install before useAnimation.ts imports).
// ---------------------------------------------------------------------------

const loaderMocks = vi.hoisted(() => ({
  loadFromURL: vi.fn(),
  loadFromFile: vi.fn(),
  loadFromArrayBuffer: vi.fn(),
}));

vi.mock('../core/three/loaders/LoaderManager', () => ({
  loaderManager: loaderMocks,
}));

// Imports must come AFTER vi.mock registration.
import { useAnimation } from './useAnimation';
import { useAnimationStore } from '../store/animationStore';
import type { AnimationManager } from '../core/three/animation/AnimationManager';

// ---------------------------------------------------------------------------
// Stub AnimationManager — records every delegated call.
// ---------------------------------------------------------------------------

type ManagerCall = { method: string; args: unknown[] };

interface StubManager {
  initialized: boolean;
  calls: ManagerCall[];
  isInitialized: () => boolean;
  addClip: (id: string, clip: THREE.AnimationClip) => void;
  play: (id: string, fadeIn?: number) => void;
  pause: () => void;
  stop: (fadeOut?: number) => void;
  seek: (time: number) => void;
  setSpeed: (speed: number) => void;
  setLoop: (loop: boolean) => void;
  setWeight: (id: string, weight: number) => void;
}

function makeStubManager(initialized = true): StubManager {
  const stub: StubManager = {
    initialized,
    calls: [],
    isInitialized: () => stub.initialized,
    addClip: (id, clip) => stub.calls.push({ method: 'addClip', args: [id, clip] }),
    play: (id, fadeIn) => stub.calls.push({ method: 'play', args: [id, fadeIn] }),
    pause: () => stub.calls.push({ method: 'pause', args: [] }),
    stop: (fadeOut) => stub.calls.push({ method: 'stop', args: [fadeOut] }),
    seek: (time) => stub.calls.push({ method: 'seek', args: [time] }),
    setSpeed: (speed) => stub.calls.push({ method: 'setSpeed', args: [speed] }),
    setLoop: (loop) => stub.calls.push({ method: 'setLoop', args: [loop] }),
    setWeight: (id, weight) =>
      stub.calls.push({ method: 'setWeight', args: [id, weight] }),
  };
  return stub;
}

function installManager(stub: StubManager | null): void {
  useAnimationStore
    .getState()
    .setAnimationManager(stub as unknown as AnimationManager);
}

function resetStore(): void {
  const s = useAnimationStore.getState();
  s.clearAnimation();
  s.setAnimationManager(null);
  s.setError(null);
}

function makeClip(name = 'idle', duration = 1.5): THREE.AnimationClip {
  return new THREE.AnimationClip(name, duration, []);
}

function loaderResult(clip: THREE.AnimationClip, name = 'idle', format = 'bvh') {
  return {
    success: true,
    data: {
      animation: clip,
      metadata: { name, format },
    },
  };
}

function loaderFailure(message = 'parse failed') {
  return { success: false, error: { message } };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useAnimation', () => {
  beforeEach(() => {
    loaderMocks.loadFromURL.mockReset();
    loaderMocks.loadFromFile.mockReset();
    loaderMocks.loadFromArrayBuffer.mockReset();
    resetStore();
  });

  afterEach(() => {
    resetStore();
  });

  // -------------------------------------------------------------------------
  // initial state
  // -------------------------------------------------------------------------

  describe('initial state', () => {
    it('exposes nulls and a default playbackState before anything loads', () => {
      const { result } = renderHook(() => useAnimation());

      expect(result.current.currentAnimation).toBeNull();
      expect(result.current.currentClipId).toBeNull();
      expect(result.current.error).toBeNull();
      expect(result.current.metadata).toBeNull();
      expect(result.current.playbackState.isPlaying).toBe(false);
      expect(result.current.playbackState.speed).toBe(1);
    });

    it('getAnimationInfo returns a placeholder before any clip loads', () => {
      const { result } = renderHook(() => useAnimation());

      expect(result.current.getAnimationInfo()).toEqual({
        name: 'No animation loaded',
        duration: 0,
        format: 'none',
      });
    });
  });

  // -------------------------------------------------------------------------
  // loaders
  // -------------------------------------------------------------------------

  describe('loadFromURL / loadFromFile / loadFromArrayBuffer', () => {
    it('loadFromURL sets animation + metadata on loader success', async () => {
      const clip = makeClip('walk', 2.0);
      loaderMocks.loadFromURL.mockResolvedValueOnce(
        loaderResult(clip, 'walk', 'vrma'),
      );

      const { result } = renderHook(() => useAnimation());
      await act(async () => {
        await result.current.loadFromURL('http://x/walk.vrma');
      });

      expect(result.current.currentAnimation).toBe(clip);
      expect(result.current.metadata).toEqual({
        name: 'walk',
        format: 'vrma',
        duration: 2.0,
      });
      expect(result.current.error).toBeNull();
    });

    it('loadFromFile sets animation + metadata on loader success', async () => {
      const clip = makeClip('run', 0.8);
      loaderMocks.loadFromFile.mockResolvedValueOnce(
        loaderResult(clip, 'run', 'bvh'),
      );

      const file = new File([new ArrayBuffer(8)], 'run.bvh');
      const { result } = renderHook(() => useAnimation());
      await act(async () => {
        await result.current.loadFromFile(file);
      });

      expect(result.current.currentAnimation).toBe(clip);
      expect(result.current.metadata?.format).toBe('bvh');
    });

    it('loadFromArrayBuffer sets animation + metadata on loader success', async () => {
      const clip = makeClip('jump', 1.0);
      loaderMocks.loadFromArrayBuffer.mockResolvedValueOnce(
        loaderResult(clip, 'jump', 'vrma'),
      );

      const { result } = renderHook(() => useAnimation());
      await act(async () => {
        await result.current.loadFromArrayBuffer(new ArrayBuffer(8), 'jump.vrma');
      });

      expect(result.current.currentAnimation).toBe(clip);
      expect(result.current.metadata?.duration).toBe(1.0);
    });

    it('surfaces loader error in state.error and leaves animation null', async () => {
      loaderMocks.loadFromURL.mockResolvedValueOnce(loaderFailure('bad data'));

      const { result } = renderHook(() => useAnimation());
      await act(async () => {
        await result.current.loadFromURL('http://x/bad');
      });

      expect(result.current.currentAnimation).toBeNull();
      expect(result.current.error).toBe('bad data');
    });

    it('falls back to a generic message when loader error has no message', async () => {
      loaderMocks.loadFromURL.mockResolvedValueOnce({ success: false, error: {} });

      const { result } = renderHook(() => useAnimation());
      await act(async () => {
        await result.current.loadFromURL('http://x/empty');
      });

      expect(result.current.error).toBe('Failed to load animation');
    });

    it('clears previous error + metadata on a new load attempt (even before it resolves)', async () => {
      const clip = makeClip('first');
      loaderMocks.loadFromURL.mockResolvedValueOnce(loaderResult(clip));
      loaderMocks.loadFromURL.mockResolvedValueOnce(loaderFailure('second-bad'));

      const { result } = renderHook(() => useAnimation());
      await act(async () => {
        await result.current.loadFromURL('http://x/first');
      });
      expect(result.current.error).toBeNull();

      // Second attempt fails — error replaced, metadata cleared.
      await act(async () => {
        await result.current.loadFromURL('http://x/second');
      });
      expect(result.current.error).toBe('second-bad');
      expect(result.current.metadata).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // manager delegation — the #30 fix
  // -------------------------------------------------------------------------

  describe('manager delegation (registerAndPlay)', () => {
    it('registers + plays the clip when a manager is initialised at load time', async () => {
      const stub = makeStubManager(true);
      installManager(stub);

      const clip = makeClip('hi');
      loaderMocks.loadFromURL.mockResolvedValueOnce(loaderResult(clip, 'hi', 'bvh'));

      const { result } = renderHook(() => useAnimation());
      await act(async () => {
        await result.current.loadFromURL('http://x/hi');
      });

      const methods = stub.calls.map((c) => c.method);
      expect(methods).toEqual(['addClip', 'play']);
      const playCall = stub.calls.find((c) => c.method === 'play')!;
      expect(playCall.args[1]).toBe(0.2); // default fadeIn
      expect(result.current.currentClipId).not.toBeNull();
      expect(typeof result.current.currentClipId).toBe('string');
    });

    it('does NOT touch the manager when it is not initialised — clip id stays null', async () => {
      const stub = makeStubManager(false);
      installManager(stub);

      const clip = makeClip('hi');
      loaderMocks.loadFromURL.mockResolvedValueOnce(loaderResult(clip));

      const { result } = renderHook(() => useAnimation());
      await act(async () => {
        await result.current.loadFromURL('http://x/hi');
      });

      expect(stub.calls).toHaveLength(0);
      expect(result.current.currentClipId).toBeNull();
      // Animation is still set in state (state-only fallback).
      expect(result.current.currentAnimation).toBe(clip);
    });

    it('does nothing on registerAndPlay when no manager is registered at all', async () => {
      const clip = makeClip('hi');
      loaderMocks.loadFromURL.mockResolvedValueOnce(loaderResult(clip));

      const { result } = renderHook(() => useAnimation());
      await act(async () => {
        await result.current.loadFromURL('http://x/hi');
      });
      expect(result.current.currentClipId).toBeNull();
      expect(result.current.currentAnimation).toBe(clip);
    });
  });

  // -------------------------------------------------------------------------
  // play / pause / stop / setTime / setSpeed / setLoop
  // -------------------------------------------------------------------------

  describe('play / pause / stop', () => {
    it('play is a noop when no animation is loaded', () => {
      const stub = makeStubManager(true);
      installManager(stub);

      const { result } = renderHook(() => useAnimation());
      act(() => {
        result.current.play();
      });

      expect(stub.calls).toHaveLength(0);
      expect(result.current.playbackState.isPlaying).toBe(false);
    });

    it('play delegates to manager.play(currentClipId) when manager is initialised', async () => {
      const stub = makeStubManager(true);
      installManager(stub);

      const clip = makeClip('hi');
      loaderMocks.loadFromURL.mockResolvedValueOnce(loaderResult(clip));

      const { result } = renderHook(() => useAnimation());
      await act(async () => {
        await result.current.loadFromURL('http://x/hi');
      });

      const clipId = result.current.currentClipId!;
      stub.calls = []; // ignore load-time addClip/play

      act(() => {
        result.current.play(0.5);
      });

      expect(stub.calls).toEqual([
        { method: 'play', args: [clipId, 0.5] },
      ]);
      expect(result.current.playbackState.isPlaying).toBe(true);
      expect(result.current.playbackState.isPaused).toBe(false);
    });

    it('play retroactively registers the clip when manager came online AFTER the clip loaded', async () => {
      // No manager during load — fallback state-only path runs.
      const clip = makeClip('late');
      loaderMocks.loadFromURL.mockResolvedValueOnce(loaderResult(clip));

      const { result, rerender } = renderHook(() => useAnimation());
      await act(async () => {
        await result.current.loadFromURL('http://x/late');
      });
      expect(result.current.currentClipId).toBeNull();

      // Manager initialises AFTER the clip is in state.
      const stub = makeStubManager(true);
      installManager(stub);
      rerender();

      act(() => {
        result.current.play();
      });

      const methods = stub.calls.map((c) => c.method);
      expect(methods).toEqual(['addClip', 'play']);
      expect(result.current.currentClipId).not.toBeNull();
    });

    it('pause delegates to manager.pause() and updates state', async () => {
      const stub = makeStubManager(true);
      installManager(stub);

      const clip = makeClip('hi');
      loaderMocks.loadFromURL.mockResolvedValueOnce(loaderResult(clip));

      const { result } = renderHook(() => useAnimation());
      await act(async () => {
        await result.current.loadFromURL('http://x/hi');
      });
      stub.calls = [];

      act(() => {
        result.current.pause();
      });

      expect(stub.calls).toEqual([{ method: 'pause', args: [] }]);
      expect(result.current.playbackState.isPlaying).toBe(false);
      expect(result.current.playbackState.isPaused).toBe(true);
    });

    it('stop delegates to manager.stop(0.2) and resets currentTime', async () => {
      const stub = makeStubManager(true);
      installManager(stub);

      const clip = makeClip('hi');
      loaderMocks.loadFromURL.mockResolvedValueOnce(loaderResult(clip));

      const { result } = renderHook(() => useAnimation());
      await act(async () => {
        await result.current.loadFromURL('http://x/hi');
      });
      stub.calls = [];

      act(() => {
        result.current.stop();
      });

      expect(stub.calls).toEqual([{ method: 'stop', args: [0.2] }]);
      expect(result.current.playbackState.isPlaying).toBe(false);
      expect(result.current.playbackState.isPaused).toBe(false);
      expect(result.current.playbackState.currentTime).toBe(0);
    });

    it('pause / stop are noops when no animation is loaded', () => {
      const stub = makeStubManager(true);
      installManager(stub);

      const { result } = renderHook(() => useAnimation());
      act(() => {
        result.current.pause();
        result.current.stop();
      });

      expect(stub.calls).toHaveLength(0);
    });
  });

  describe('setTime / setSpeed / setLoop', () => {
    async function loadClip(stub: StubManager) {
      installManager(stub);
      const clip = makeClip('hi');
      loaderMocks.loadFromURL.mockResolvedValueOnce(loaderResult(clip));
      const { result } = renderHook(() => useAnimation());
      await act(async () => {
        await result.current.loadFromURL('http://x/hi');
      });
      stub.calls = [];
      return result;
    }

    it('setTime delegates to manager.seek and updates currentTime', async () => {
      const stub = makeStubManager(true);
      const result = await loadClip(stub);
      act(() => {
        result.current.setTime(2.5);
      });
      expect(stub.calls).toEqual([{ method: 'seek', args: [2.5] }]);
      expect(result.current.playbackState.currentTime).toBe(2.5);
    });

    it('setSpeed clamps to [0.1, 5] and forwards the clamped value', async () => {
      const stub = makeStubManager(true);
      const result = await loadClip(stub);

      act(() => {
        result.current.setSpeed(0); // below floor
      });
      expect(stub.calls[stub.calls.length - 1]).toEqual({
        method: 'setSpeed',
        args: [0.1],
      });
      expect(result.current.playbackState.speed).toBe(0.1);

      act(() => {
        result.current.setSpeed(99); // above ceiling
      });
      expect(stub.calls[stub.calls.length - 1]).toEqual({
        method: 'setSpeed',
        args: [5],
      });
      expect(result.current.playbackState.speed).toBe(5);

      act(() => {
        result.current.setSpeed(1.5); // in range
      });
      expect(stub.calls[stub.calls.length - 1]).toEqual({
        method: 'setSpeed',
        args: [1.5],
      });
      expect(result.current.playbackState.speed).toBe(1.5);
    });

    it('setLoop delegates to manager.setLoop and updates isLooping', async () => {
      const stub = makeStubManager(true);
      const result = await loadClip(stub);

      act(() => {
        result.current.setLoop(true);
      });
      expect(stub.calls).toEqual([{ method: 'setLoop', args: [true] }]);
      expect(result.current.playbackState.isLooping).toBe(true);

      act(() => {
        result.current.setLoop(false);
      });
      expect(result.current.playbackState.isLooping).toBe(false);
    });

    it('all four are noops when no animation is loaded', () => {
      const stub = makeStubManager(true);
      installManager(stub);
      const { result } = renderHook(() => useAnimation());

      act(() => {
        result.current.setTime(5);
        result.current.setSpeed(2);
        result.current.setLoop(true);
      });
      expect(stub.calls).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // setWeight (new in #30)
  // -------------------------------------------------------------------------

  describe('setWeight', () => {
    it('clamps to [0, 1] and forwards to manager.setWeight(currentClipId, value)', async () => {
      const stub = makeStubManager(true);
      installManager(stub);
      const clip = makeClip('hi');
      loaderMocks.loadFromURL.mockResolvedValueOnce(loaderResult(clip));
      const { result } = renderHook(() => useAnimation());
      await act(async () => {
        await result.current.loadFromURL('http://x/hi');
      });

      const clipId = result.current.currentClipId!;
      stub.calls = [];

      act(() => {
        result.current.setWeight(-1); // below floor
      });
      expect(stub.calls[stub.calls.length - 1]).toEqual({
        method: 'setWeight',
        args: [clipId, 0],
      });
      expect(result.current.playbackState.weight).toBe(0);

      act(() => {
        result.current.setWeight(1.5); // above ceiling
      });
      expect(stub.calls[stub.calls.length - 1]).toEqual({
        method: 'setWeight',
        args: [clipId, 1],
      });
      expect(result.current.playbackState.weight).toBe(1);

      act(() => {
        result.current.setWeight(0.7);
      });
      expect(stub.calls[stub.calls.length - 1]).toEqual({
        method: 'setWeight',
        args: [clipId, 0.7],
      });
    });

    it('updates playbackState even when manager is not initialised (state-only shim)', () => {
      const stub = makeStubManager(false);
      installManager(stub);

      const { result } = renderHook(() => useAnimation());
      act(() => {
        result.current.setWeight(0.5);
      });
      expect(stub.calls).toHaveLength(0);
      expect(result.current.playbackState.weight).toBe(0.5);
    });
  });

  // -------------------------------------------------------------------------
  // getAnimationInfo
  // -------------------------------------------------------------------------

  describe('getAnimationInfo (after a clip is loaded)', () => {
    it('returns the clip name / duration / a "three" format tag', async () => {
      const clip = makeClip('walk', 2.5);
      loaderMocks.loadFromURL.mockResolvedValueOnce(loaderResult(clip, 'walk', 'bvh'));

      const { result } = renderHook(() => useAnimation());
      await act(async () => {
        await result.current.loadFromURL('http://x/walk');
      });

      expect(result.current.getAnimationInfo()).toEqual({
        name: 'walk',
        duration: 2.5,
        format: 'three',
      });
    });
  });
});
