/**
 * useBlendShapes — coverage of lip-sync, per-eye blink, expression sync, and
 * the manager-identity-change render path (all of which landed in #29).
 *
 * Plus the two sibling hooks exported from the same module:
 *   - useBlendShapeValue: a tiny controlled-input helper
 *   - useExpression: a UI-side expression state hook with no manager hookup
 *
 * BlendShapeManager is replaced by a stub installed into animationStore
 * directly — building a real one needs a live VRM.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useBlendShapes,
  useBlendShapeValue,
  useExpression,
} from './useBlendShapes';
import { useAnimationStore } from '../store/animationStore';
import type { BlendShapeManager } from '../core/three/animation/BlendShapeManager';

// ---------------------------------------------------------------------------
// Stub manager
// ---------------------------------------------------------------------------

type Call = { method: string; args: unknown[] };

interface StubBlendShapeManager {
  initialized: boolean;
  state: Record<string, number>;
  expression: { preset: string; weight: number } | null;
  available: string[];
  throwOnSetExpression: boolean;
  throwOnSetLipSync: boolean;
  calls: Call[];

  isInitialized: () => boolean;
  getAvailableBlendShapes: () => string[];
  getAllBlendShapes: () => Record<string, number>;
  getBlendShape: (name: string) => number;
  hasBlendShape: (name: string) => boolean;
  getExpression: () => { preset: string; weight: number } | null;
  setBlendShape: (name: string, value: number) => void;
  setBlendShapes: (map: Record<string, number>) => void;
  setExpression: (preset: string, weight: number) => void;
  clearExpression: () => void;
  setLipSync: (viseme: string, weight: number) => void;
  clearLipSync: () => void;
  setEyeBlink: (left: number, right: number) => void;
  setBothEyesBlink: (value: number) => void;
  reset: () => void;
}

function makeStubManager(opts: Partial<StubBlendShapeManager> = {}): StubBlendShapeManager {
  const stub: StubBlendShapeManager = {
    initialized: true,
    state: {},
    expression: null,
    available: ['happy', 'angry', 'sad', 'surprised', 'aa', 'ih', 'ou', 'ee', 'oh', 'blink'],
    throwOnSetExpression: false,
    throwOnSetLipSync: false,
    calls: [],
    ...opts,

    isInitialized: () => stub.initialized,
    getAvailableBlendShapes: () => [...stub.available],
    getAllBlendShapes: () => ({ ...stub.state }),
    getBlendShape: (name) => stub.state[name] ?? 0,
    hasBlendShape: (name) => stub.available.includes(name),
    getExpression: () => (stub.expression ? { ...stub.expression } : null),

    setBlendShape: (name, value) => {
      stub.calls.push({ method: 'setBlendShape', args: [name, value] });
      stub.state[name] = value;
    },
    setBlendShapes: (map) => {
      stub.calls.push({ method: 'setBlendShapes', args: [map] });
      stub.state = { ...stub.state, ...map };
    },
    setExpression: (preset, weight) => {
      stub.calls.push({ method: 'setExpression', args: [preset, weight] });
      if (stub.throwOnSetExpression) throw new Error('setExpression failed');
      stub.expression = { preset, weight };
      // Manager mutates the underlying blend shapes — mirror enough of that
      // for the hook's getAllBlendShapes refresh.
      stub.state[preset] = weight;
    },
    clearExpression: () => {
      stub.calls.push({ method: 'clearExpression', args: [] });
      stub.expression = null;
    },
    setLipSync: (viseme, weight) => {
      stub.calls.push({ method: 'setLipSync', args: [viseme, weight] });
      if (stub.throwOnSetLipSync) throw new Error('setLipSync failed');
      stub.state[viseme] = weight;
    },
    clearLipSync: () => {
      stub.calls.push({ method: 'clearLipSync', args: [] });
    },
    setEyeBlink: (left, right) => {
      stub.calls.push({ method: 'setEyeBlink', args: [left, right] });
      stub.state.blinkLeft = left;
      stub.state.blinkRight = right;
    },
    setBothEyesBlink: (value) => {
      stub.calls.push({ method: 'setBothEyesBlink', args: [value] });
      stub.state.blink = value;
    },
    reset: () => {
      stub.calls.push({ method: 'reset', args: [] });
      stub.state = {};
      stub.expression = null;
    },
  };
  return stub;
}

function installManager(stub: StubBlendShapeManager | null): void {
  act(() => {
    useAnimationStore
      .getState()
      .setBlendShapeManager(stub as unknown as BlendShapeManager);
  });
}

function resetStore(): void {
  act(() => {
    useAnimationStore.getState().setBlendShapeManager(null);
  });
}

// ---------------------------------------------------------------------------
// useBlendShapes
// ---------------------------------------------------------------------------

describe('useBlendShapes', () => {
  beforeEach(() => {
    resetStore();
  });

  afterEach(() => {
    resetStore();
  });

  describe('initial state (no manager)', () => {
    it('returns DEFAULT_BLEND_SHAPES and empty current map', () => {
      const { result } = renderHook(() => useBlendShapes());

      expect(result.current.availableBlendShapes).toContain('blink');
      expect(result.current.availableBlendShapes).toContain('aa');
      expect(result.current.currentBlendShapes).toEqual({});
      expect(result.current.currentExpression).toBeNull();
      expect(result.current.expressionWeight).toBe(1);
      expect(result.current.currentLipSync).toBeNull();
      expect(result.current.lipSyncWeight).toBe(1);
      expect(result.current.eyeBlink).toEqual({ left: 0, right: 0 });
    });

    it('hasBlendShape falls back to availableBlendShapes when manager absent', () => {
      const { result } = renderHook(() => useBlendShapes());
      expect(result.current.hasBlendShape('blink')).toBe(true);
      expect(result.current.hasBlendShape('does-not-exist')).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // manager identity change → sync from manager
  // -------------------------------------------------------------------------

  describe('manager identity change', () => {
    it('hydrates available shapes + current state when a manager attaches', () => {
      const stub = makeStubManager({
        available: ['happy', 'sad'],
        state: { happy: 0.3, sad: 0 },
        expression: { preset: 'joy', weight: 0.7 },
      });

      const { result, rerender } = renderHook(() => useBlendShapes());
      expect(result.current.availableBlendShapes).not.toEqual(['happy', 'sad']);

      installManager(stub);
      rerender();

      expect(result.current.availableBlendShapes).toEqual(['happy', 'sad']);
      expect(result.current.currentBlendShapes).toEqual({ happy: 0.3, sad: 0 });
      expect(result.current.currentExpression).toBe('joy');
      expect(result.current.expressionWeight).toBe(0.7);
    });

    it('falls back to DEFAULT_BLEND_SHAPES when the manager exposes none', () => {
      const stub = makeStubManager({ available: [] });

      const { result, rerender } = renderHook(() => useBlendShapes());
      installManager(stub);
      rerender();

      expect(result.current.availableBlendShapes).toContain('blink');
    });

    it('resets to defaults when the manager detaches (null)', () => {
      // Render with no manager first so the identity-change effect can
      // observe the null → stub → null transitions.
      const { result, rerender } = renderHook(() => useBlendShapes());

      const stub = makeStubManager({
        available: ['happy'],
        state: { happy: 0.5 },
      });
      installManager(stub);
      rerender();
      expect(result.current.availableBlendShapes).toEqual(['happy']);

      installManager(null);
      rerender();

      // Defaults restored.
      expect(result.current.availableBlendShapes).toContain('blink');
      expect(result.current.currentBlendShapes).toEqual({});
      expect(result.current.currentExpression).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // direct blend shapes
  // -------------------------------------------------------------------------

  describe('setBlendShape / setBlendShapes', () => {
    it('setBlendShape clamps to [0, 1] and forwards to manager', () => {
      const stub = makeStubManager();
      installManager(stub);

      const { result } = renderHook(() => useBlendShapes());

      act(() => {
        result.current.setBlendShape('happy', 1.5);
      });
      expect(stub.calls).toEqual([
        { method: 'setBlendShape', args: ['happy', 1] },
      ]);
      expect(result.current.currentBlendShapes.happy).toBe(1);

      act(() => {
        result.current.setBlendShape('sad', -0.5);
      });
      expect(stub.calls[stub.calls.length - 1]).toEqual({
        method: 'setBlendShape',
        args: ['sad', 0],
      });
      expect(result.current.currentBlendShapes.sad).toBe(0);
    });

    it('setBlendShape updates state even when no manager is registered', () => {
      const { result } = renderHook(() => useBlendShapes());
      act(() => {
        result.current.setBlendShape('happy', 0.5);
      });
      expect(result.current.currentBlendShapes).toEqual({ happy: 0.5 });
    });

    it('setBlendShapes normalises every value and replaces the current map', () => {
      const stub = makeStubManager();
      installManager(stub);

      const { result } = renderHook(() => useBlendShapes());
      act(() => {
        result.current.setBlendShapes({ happy: 2, sad: -1, surprised: 0.6 });
      });

      expect(result.current.currentBlendShapes).toEqual({
        happy: 1,
        sad: 0,
        surprised: 0.6,
      });
      expect(stub.calls).toEqual([
        {
          method: 'setBlendShapes',
          args: [{ happy: 1, sad: 0, surprised: 0.6 }],
        },
      ]);
    });
  });

  // -------------------------------------------------------------------------
  // expression presets
  // -------------------------------------------------------------------------

  describe('setExpression / clearExpression', () => {
    it('setExpression clamps weight, forwards to manager, and updates currentExpression', () => {
      const stub = makeStubManager();
      installManager(stub);

      const { result } = renderHook(() => useBlendShapes());
      act(() => {
        result.current.setExpression('joy', 1.5);
      });

      expect(stub.calls).toEqual([
        { method: 'setExpression', args: ['joy', 1] },
      ]);
      expect(result.current.currentExpression).toBe('joy');
      expect(result.current.expressionWeight).toBe(1);
    });

    it('defaults weight to 1 when omitted', () => {
      const stub = makeStubManager();
      installManager(stub);

      const { result } = renderHook(() => useBlendShapes());
      act(() => {
        result.current.setExpression('joy');
      });

      expect(stub.calls[0].args[1]).toBe(1);
      expect(result.current.expressionWeight).toBe(1);
    });

    it('keeps state untouched when manager.setExpression throws (caught + warned)', () => {
      const stub = makeStubManager({ throwOnSetExpression: true });
      installManager(stub);
      // Silence the expected warn — test asserts state remains clean.
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const { result } = renderHook(() => useBlendShapes());
      act(() => {
        result.current.setExpression('joy');
      });

      expect(result.current.currentExpression).toBeNull();
      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });

    it('clearExpression resets state and delegates', () => {
      const stub = makeStubManager();
      installManager(stub);

      const { result } = renderHook(() => useBlendShapes());
      act(() => {
        result.current.setExpression('joy', 0.5);
      });
      expect(result.current.currentExpression).toBe('joy');

      act(() => {
        result.current.clearExpression();
      });

      expect(stub.calls.map((c) => c.method)).toContain('clearExpression');
      expect(result.current.currentExpression).toBeNull();
      expect(result.current.expressionWeight).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // lip-sync (new in #29)
  // -------------------------------------------------------------------------

  describe('setLipSync / clearLipSync', () => {
    it('setLipSync clamps weight, forwards to manager, and updates currentLipSync', () => {
      const stub = makeStubManager();
      installManager(stub);

      const { result } = renderHook(() => useBlendShapes());
      act(() => {
        result.current.setLipSync('aa', 1.5);
      });

      expect(stub.calls).toEqual([
        { method: 'setLipSync', args: ['aa', 1] },
      ]);
      expect(result.current.currentLipSync).toBe('aa');
      expect(result.current.lipSyncWeight).toBe(1);
    });

    it('defaults weight to 1 when omitted', () => {
      const stub = makeStubManager();
      installManager(stub);

      const { result } = renderHook(() => useBlendShapes());
      act(() => {
        result.current.setLipSync('aa');
      });

      expect(stub.calls[0].args[1]).toBe(1);
    });

    it('keeps state untouched when manager.setLipSync throws (caught + warned)', () => {
      const stub = makeStubManager({ throwOnSetLipSync: true });
      installManager(stub);
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const { result } = renderHook(() => useBlendShapes());
      act(() => {
        result.current.setLipSync('aa');
      });

      expect(result.current.currentLipSync).toBeNull();
      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });

    it('clearLipSync resets state and delegates', () => {
      const stub = makeStubManager();
      installManager(stub);

      const { result } = renderHook(() => useBlendShapes());
      act(() => {
        result.current.setLipSync('aa', 0.5);
      });
      expect(result.current.currentLipSync).toBe('aa');

      act(() => {
        result.current.clearLipSync();
      });

      expect(stub.calls.map((c) => c.method)).toContain('clearLipSync');
      expect(result.current.currentLipSync).toBeNull();
      expect(result.current.lipSyncWeight).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // eye blink (new in #29)
  // -------------------------------------------------------------------------

  describe('setEyeBlink / setBothEyesBlink', () => {
    it('setEyeBlink clamps both eyes independently and forwards to manager', () => {
      const stub = makeStubManager();
      installManager(stub);

      const { result } = renderHook(() => useBlendShapes());
      act(() => {
        result.current.setEyeBlink(1.5, -0.2);
      });

      expect(stub.calls).toEqual([
        { method: 'setEyeBlink', args: [1, 0] },
      ]);
      expect(result.current.eyeBlink).toEqual({ left: 1, right: 0 });
    });

    it('setEyeBlink updates state even without a manager', () => {
      const { result } = renderHook(() => useBlendShapes());
      act(() => {
        result.current.setEyeBlink(0.3, 0.7);
      });
      expect(result.current.eyeBlink).toEqual({ left: 0.3, right: 0.7 });
    });

    it('setBothEyesBlink clamps and applies the same value to both eyes', () => {
      const stub = makeStubManager();
      installManager(stub);

      const { result } = renderHook(() => useBlendShapes());
      act(() => {
        result.current.setBothEyesBlink(1.5);
      });

      expect(stub.calls).toEqual([
        { method: 'setBothEyesBlink', args: [1] },
      ]);
      expect(result.current.eyeBlink).toEqual({ left: 1, right: 1 });
    });
  });

  // -------------------------------------------------------------------------
  // reset + accessors
  // -------------------------------------------------------------------------

  describe('reset / getBlendShape / hasBlendShape', () => {
    it('resetBlendShapes clears all UI state and delegates', () => {
      const stub = makeStubManager();
      installManager(stub);

      const { result } = renderHook(() => useBlendShapes());
      act(() => {
        result.current.setExpression('joy', 0.5);
        result.current.setLipSync('aa', 0.7);
        result.current.setEyeBlink(0.4, 0.5);
      });

      act(() => {
        result.current.resetBlendShapes();
      });

      expect(stub.calls.map((c) => c.method)).toContain('reset');
      expect(result.current.currentExpression).toBeNull();
      expect(result.current.currentLipSync).toBeNull();
      expect(result.current.expressionWeight).toBe(1);
      expect(result.current.lipSyncWeight).toBe(1);
      expect(result.current.eyeBlink).toEqual({ left: 0, right: 0 });
      expect(result.current.currentBlendShapes).toEqual({});
    });

    it('getBlendShape prefers the manager value over the local cache', () => {
      const stub = makeStubManager({ state: { happy: 0.42 } });
      installManager(stub);

      const { result } = renderHook(() => useBlendShapes());
      expect(result.current.getBlendShape('happy')).toBe(0.42);
    });

    it('getBlendShape falls back to local cache when manager absent', () => {
      const { result } = renderHook(() => useBlendShapes());
      act(() => {
        result.current.setBlendShape('happy', 0.5);
      });
      expect(result.current.getBlendShape('happy')).toBe(0.5);
    });

    it('hasBlendShape delegates to manager when initialised', () => {
      const stub = makeStubManager({ available: ['custom-shape'] });
      installManager(stub);

      const { result } = renderHook(() => useBlendShapes());
      expect(result.current.hasBlendShape('custom-shape')).toBe(true);
      expect(result.current.hasBlendShape('missing')).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// useBlendShapeValue
// ---------------------------------------------------------------------------

describe('useBlendShapeValue', () => {
  it('exposes value + setValue starting at 0', () => {
    const { result } = renderHook(() => useBlendShapeValue());
    expect(result.current.value).toBe(0);
  });

  it('clamps the new value to [0, 1]', () => {
    const { result } = renderHook(() => useBlendShapeValue());
    act(() => {
      result.current.setValue(1.5);
    });
    expect(result.current.value).toBe(1);

    act(() => {
      result.current.setValue(-0.3);
    });
    expect(result.current.value).toBe(0);

    act(() => {
      result.current.setValue(0.6);
    });
    expect(result.current.value).toBe(0.6);
  });
});

// ---------------------------------------------------------------------------
// useExpression
// ---------------------------------------------------------------------------

describe('useExpression', () => {
  it('starts with null expression and weight=1', () => {
    const { result } = renderHook(() => useExpression());
    expect(result.current.currentExpression).toBeNull();
    expect(result.current.weight).toBe(1);
  });

  it('setExpression sets preset and clamps weight', () => {
    const { result } = renderHook(() => useExpression());
    act(() => {
      result.current.setExpression('joy', 1.5);
    });
    expect(result.current.currentExpression).toBe('joy');
    expect(result.current.weight).toBe(1);

    act(() => {
      result.current.setExpression('sad', -0.5);
    });
    expect(result.current.weight).toBe(0);
  });

  it('defaults weight to 1 when omitted', () => {
    const { result } = renderHook(() => useExpression());
    act(() => {
      result.current.setExpression('joy');
    });
    expect(result.current.weight).toBe(1);
  });

  it('clearExpression resets both fields', () => {
    const { result } = renderHook(() => useExpression());
    act(() => {
      result.current.setExpression('joy', 0.5);
    });
    expect(result.current.currentExpression).toBe('joy');

    act(() => {
      result.current.clearExpression();
    });
    expect(result.current.currentExpression).toBeNull();
    expect(result.current.weight).toBe(1);
  });
});
