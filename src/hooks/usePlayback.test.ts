/**
 * usePlayback — thin wrapper over usePlaybackStore.
 *
 * The hook adds:
 *   - a `progress` derived value (currentTime / duration)
 *   - a `seekToProgress` helper that clamps 0..1 and maps to seek()
 *   - a `toggleLoop` callback
 *
 * Plus two selector hooks: usePlaybackState (state only) and
 * usePlaybackActions (actions only). All paths exercised below.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  usePlayback,
  usePlaybackState,
  usePlaybackActions,
} from './usePlayback';
import { usePlaybackStore } from '../store/playbackStore';

function resetStore(): void {
  act(() => {
    usePlaybackStore.getState().reset();
  });
}

describe('usePlayback', () => {
  beforeEach(() => {
    resetStore();
  });

  describe('state exposure', () => {
    it('reflects store state and exposes loop default (true)', () => {
      const { result } = renderHook(() => usePlayback());
      expect(result.current.isPlaying).toBe(false);
      expect(result.current.isPaused).toBe(false);
      expect(result.current.isStopped).toBe(true);
      expect(result.current.loop).toBe(true);
      expect(result.current.speed).toBe(1);
      expect(result.current.currentTime).toBe(0);
      expect(result.current.duration).toBe(0);
    });

    it('progress is 0 when duration is 0 (avoids divide-by-zero)', () => {
      const { result } = renderHook(() => usePlayback());
      expect(result.current.progress).toBe(0);
    });

    it('progress = currentTime / duration when duration > 0', () => {
      act(() => {
        usePlaybackStore.getState().setDuration(10);
        usePlaybackStore.getState().updateCurrentTime(2.5);
      });
      const { result } = renderHook(() => usePlayback());
      expect(result.current.progress).toBe(0.25);
    });
  });

  describe('actions', () => {
    it('play / pause / stop transition state correctly', () => {
      const { result } = renderHook(() => usePlayback());

      act(() => {
        result.current.play();
      });
      expect(result.current.isPlaying).toBe(true);
      expect(result.current.isStopped).toBe(false);

      act(() => {
        result.current.pause();
      });
      expect(result.current.isPaused).toBe(true);
      expect(result.current.isPlaying).toBe(false);

      act(() => {
        result.current.stop();
      });
      expect(result.current.isStopped).toBe(true);
      expect(result.current.currentTime).toBe(0);
    });

    it('seek clamps to [0, duration]', () => {
      act(() => {
        usePlaybackStore.getState().setDuration(10);
      });
      const { result } = renderHook(() => usePlayback());

      act(() => {
        result.current.seek(-5);
      });
      expect(result.current.currentTime).toBe(0);

      act(() => {
        result.current.seek(99);
      });
      expect(result.current.currentTime).toBe(10);

      act(() => {
        result.current.seek(3);
      });
      expect(result.current.currentTime).toBe(3);
    });

    it('seekToProgress clamps 0..1 and maps to currentTime = progress * duration', () => {
      act(() => {
        usePlaybackStore.getState().setDuration(20);
      });
      const { result } = renderHook(() => usePlayback());

      act(() => {
        result.current.seekToProgress(-1); // below
      });
      expect(result.current.currentTime).toBe(0);

      act(() => {
        result.current.seekToProgress(2); // above
      });
      expect(result.current.currentTime).toBe(20);

      act(() => {
        result.current.seekToProgress(0.25);
      });
      expect(result.current.currentTime).toBe(5);
    });

    it('setSpeed clamps to [0.1, 5] (delegated via store)', () => {
      const { result } = renderHook(() => usePlayback());

      act(() => {
        result.current.setSpeed(0);
      });
      expect(result.current.speed).toBe(0.1);

      act(() => {
        result.current.setSpeed(99);
      });
      expect(result.current.speed).toBe(5);
    });

    it('toggleLoop flips the loop flag (starts true)', () => {
      const { result } = renderHook(() => usePlayback());
      expect(result.current.loop).toBe(true);

      act(() => {
        result.current.toggleLoop();
      });
      expect(result.current.loop).toBe(false);

      act(() => {
        result.current.toggleLoop();
      });
      expect(result.current.loop).toBe(true);
    });

    it('setLoop sets the loop flag directly', () => {
      const { result } = renderHook(() => usePlayback());
      act(() => {
        result.current.setLoop(false);
      });
      expect(result.current.loop).toBe(false);

      act(() => {
        result.current.setLoop(true);
      });
      expect(result.current.loop).toBe(true);
    });

    it('setCurrentAnimation / clearCurrentAnimation update the named clip', () => {
      const { result } = renderHook(() => usePlayback());
      act(() => {
        result.current.setCurrentAnimation('id-1', 'Walk');
      });
      expect(result.current.currentAnimationId).toBe('id-1');
      expect(result.current.currentAnimationName).toBe('Walk');

      act(() => {
        result.current.clearCurrentAnimation();
      });
      expect(result.current.currentAnimationId).toBeNull();
      expect(result.current.currentAnimationName).toBeNull();
    });
  });
});

describe('usePlaybackState', () => {
  beforeEach(() => {
    resetStore();
  });

  it('exposes only state fields including derived progress', () => {
    act(() => {
      usePlaybackStore.getState().setDuration(8);
      usePlaybackStore.getState().updateCurrentTime(4);
    });

    const { result } = renderHook(() => usePlaybackState());
    expect(result.current.duration).toBe(8);
    expect(result.current.currentTime).toBe(4);
    expect(result.current.progress).toBe(0.5);
    // No actions exposed.
    expect((result.current as Record<string, unknown>).play).toBeUndefined();
  });

  it('progress is 0 when duration is 0', () => {
    const { result } = renderHook(() => usePlaybackState());
    expect(result.current.progress).toBe(0);
  });
});

describe('usePlaybackActions', () => {
  beforeEach(() => {
    resetStore();
  });

  it('exposes the action set', () => {
    const { result } = renderHook(() => usePlaybackActions());
    expect(typeof result.current.play).toBe('function');
    expect(typeof result.current.pause).toBe('function');
    expect(typeof result.current.stop).toBe('function');
    expect(typeof result.current.seek).toBe('function');
    expect(typeof result.current.setSpeed).toBe('function');
    expect(typeof result.current.setLoop).toBe('function');
    expect(typeof result.current.updateCurrentTime).toBe('function');
    expect(typeof result.current.setDuration).toBe('function');
  });

  it('updateCurrentTime + setDuration mutate the store', () => {
    const { result } = renderHook(() => usePlaybackActions());
    act(() => {
      result.current.setDuration(5);
      result.current.updateCurrentTime(2);
    });
    expect(usePlaybackStore.getState().duration).toBe(5);
    expect(usePlaybackStore.getState().currentTime).toBe(2);
  });
});
