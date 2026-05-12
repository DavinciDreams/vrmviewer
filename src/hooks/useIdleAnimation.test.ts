/**
 * useIdleAnimation + useBreathing + useBlinking — coverage for the three
 * exports from useIdleAnimation.ts.
 *
 * useIdleAnimation delegates to IdleAnimationController via animationStore.
 * Same identity-change sync pattern as useBlendShapes; covered the same way:
 * stub controller installed into the store, identity transition triggers
 * the hydrate path.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useIdleAnimation,
  useBreathing,
  useBlinking,
} from './useIdleAnimation';
import { useAnimationStore } from '../store/animationStore';
import type { IdleAnimationController } from '../core/three/animation/IdleAnimationController';

type Call = { method: string; args: unknown[] };

interface StubController {
  initialized: boolean;
  state: {
    breathing: {
      enabled: boolean;
      rate: number;
      depth: number;
      chestExpansion: number;
      shoulderMovement: number;
    };
    blinking: {
      enabled: boolean;
      frequency: number;
      minDuration: number;
      maxDuration: number;
      randomize: boolean;
    };
    isRunning: boolean;
  };
  calls: Call[];
  isInitialized: () => boolean;
  getState: () => StubController['state'];
  start: () => void;
  stop: () => void;
  setBreathingConfig: (cfg: Record<string, unknown>) => void;
  setBlinkingConfig: (cfg: Record<string, unknown>) => void;
}

function makeStubController(opts: Partial<StubController['state']> = {}): StubController {
  const stub: StubController = {
    initialized: true,
    calls: [],
    state: {
      breathing: {
        enabled: true,
        rate: 12,
        depth: 0.5,
        chestExpansion: 0.02,
        shoulderMovement: 0.01,
      },
      blinking: {
        enabled: true,
        frequency: 15,
        minDuration: 0.1,
        maxDuration: 0.2,
        randomize: true,
      },
      isRunning: true,
      ...opts,
    },
    isInitialized: () => stub.initialized,
    getState: () => stub.state,
    start: () => {
      stub.calls.push({ method: 'start', args: [] });
      stub.state.isRunning = true;
    },
    stop: () => {
      stub.calls.push({ method: 'stop', args: [] });
      stub.state.isRunning = false;
    },
    setBreathingConfig: (cfg) => {
      stub.calls.push({ method: 'setBreathingConfig', args: [cfg] });
    },
    setBlinkingConfig: (cfg) => {
      stub.calls.push({ method: 'setBlinkingConfig', args: [cfg] });
    },
  };
  return stub;
}

function installController(stub: StubController | null): void {
  act(() => {
    useAnimationStore
      .getState()
      .setIdleAnimationController(stub as unknown as IdleAnimationController);
  });
}

function resetStore(): void {
  act(() => {
    useAnimationStore.getState().setIdleAnimationController(null);
  });
}

describe('useIdleAnimation', () => {
  beforeEach(() => {
    resetStore();
  });
  afterEach(() => {
    resetStore();
  });

  describe('initial state (no controller)', () => {
    it('exposes default breathing + blinking configs and isRunning=true', () => {
      const { result } = renderHook(() => useIdleAnimation());
      expect(result.current.breathing.enabled).toBe(true);
      expect(result.current.breathing.rate).toBe(12);
      expect(result.current.blinking.enabled).toBe(true);
      expect(result.current.blinking.frequency).toBe(15);
      expect(result.current.isRunning).toBe(true);
    });
  });

  describe('controller identity change', () => {
    it('hydrates state from controller.getState() on attach', () => {
      const { result, rerender } = renderHook(() => useIdleAnimation());

      const stub = makeStubController({
        breathing: {
          enabled: false,
          rate: 8,
          depth: 0.3,
          chestExpansion: 0.05,
          shoulderMovement: 0.02,
        } as any,
        blinking: {
          enabled: true,
          frequency: 30,
          minDuration: 0.2,
          maxDuration: 0.5,
          randomize: false,
        } as any,
        isRunning: false,
      });
      installController(stub);
      rerender();

      expect(result.current.breathing.rate).toBe(8);
      expect(result.current.breathing.enabled).toBe(false);
      expect(result.current.blinking.frequency).toBe(30);
      expect(result.current.isRunning).toBe(false);
    });
  });

  describe('actions', () => {
    it('start delegates to controller.start() and sets isRunning=true', () => {
      const stub = makeStubController({ isRunning: false } as any);
      installController(stub);

      const { result } = renderHook(() => useIdleAnimation());
      act(() => {
        result.current.start();
      });
      expect(stub.calls.map((c) => c.method)).toContain('start');
      expect(result.current.isRunning).toBe(true);
    });

    it('stop delegates to controller.stop() and sets isRunning=false', () => {
      const stub = makeStubController();
      installController(stub);

      const { result } = renderHook(() => useIdleAnimation());
      act(() => {
        result.current.stop();
      });
      expect(stub.calls.map((c) => c.method)).toContain('stop');
      expect(result.current.isRunning).toBe(false);
    });

    it('toggle flips isRunning and delegates to the right method', () => {
      const stub = makeStubController();
      installController(stub);

      const { result } = renderHook(() => useIdleAnimation());
      // starts true
      act(() => {
        result.current.toggle();
      });
      expect(result.current.isRunning).toBe(false);
      expect(stub.calls[stub.calls.length - 1].method).toBe('stop');

      act(() => {
        result.current.toggle();
      });
      expect(result.current.isRunning).toBe(true);
      expect(stub.calls[stub.calls.length - 1].method).toBe('start');
    });
  });

  describe('breathing config setters', () => {
    it('setBreathingEnabled forwards { enabled } without touching isRunning', () => {
      const stub = makeStubController();
      installController(stub);

      const { result } = renderHook(() => useIdleAnimation());
      const wasRunning = result.current.isRunning;
      act(() => {
        result.current.setBreathingEnabled(false);
      });
      expect(stub.calls).toContainEqual({
        method: 'setBreathingConfig',
        args: [{ enabled: false }],
      });
      expect(result.current.breathing.enabled).toBe(false);
      expect(result.current.isRunning).toBe(wasRunning);
    });

    it('setBreathingRate clamps to [1, 30]', () => {
      const stub = makeStubController();
      installController(stub);

      const { result } = renderHook(() => useIdleAnimation());
      act(() => {
        result.current.setBreathingRate(0);
      });
      expect(result.current.breathing.rate).toBe(1);

      act(() => {
        result.current.setBreathingRate(99);
      });
      expect(result.current.breathing.rate).toBe(30);

      act(() => {
        result.current.setBreathingRate(15);
      });
      expect(result.current.breathing.rate).toBe(15);
    });

    it('setBreathingDepth clamps to [0, 1]', () => {
      const { result } = renderHook(() => useIdleAnimation());
      act(() => {
        result.current.setBreathingDepth(-0.5);
      });
      expect(result.current.breathing.depth).toBe(0);

      act(() => {
        result.current.setBreathingDepth(99);
      });
      expect(result.current.breathing.depth).toBe(1);
    });
  });

  describe('blinking config setters', () => {
    it('setBlinkingFrequency clamps to [1, 60]', () => {
      const { result } = renderHook(() => useIdleAnimation());
      act(() => {
        result.current.setBlinkingFrequency(0);
      });
      expect(result.current.blinking.frequency).toBe(1);

      act(() => {
        result.current.setBlinkingFrequency(99);
      });
      expect(result.current.blinking.frequency).toBe(60);
    });

    it('setBlinkingDuration enforces min >= 0.05 and max >= min', () => {
      const { result } = renderHook(() => useIdleAnimation());
      act(() => {
        result.current.setBlinkingDuration(0.01, 0.001);
      });
      expect(result.current.blinking.minDuration).toBe(0.05);
      expect(result.current.blinking.maxDuration).toBe(0.05); // forced up to min

      act(() => {
        result.current.setBlinkingDuration(0.2, 0.5);
      });
      expect(result.current.blinking.minDuration).toBe(0.2);
      expect(result.current.blinking.maxDuration).toBe(0.5);
    });

    it('setRandomizeBlinking forwards { randomize }', () => {
      const stub = makeStubController();
      installController(stub);

      const { result } = renderHook(() => useIdleAnimation());
      act(() => {
        result.current.setRandomizeBlinking(false);
      });
      expect(stub.calls).toContainEqual({
        method: 'setBlinkingConfig',
        args: [{ randomize: false }],
      });
      expect(result.current.blinking.randomize).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// useBreathing
// ---------------------------------------------------------------------------

describe('useBreathing', () => {
  it('starts with default breathing config', () => {
    const { result } = renderHook(() => useBreathing());
    expect(result.current.config.rate).toBe(12);
    expect(result.current.config.depth).toBe(0.5);
  });

  it('setConfig clamps rate to [1, 30]', () => {
    const { result } = renderHook(() => useBreathing());
    act(() => {
      result.current.setConfig({ rate: 0 });
    });
    expect(result.current.config.rate).toBe(1);

    act(() => {
      result.current.setConfig({ rate: 99 });
    });
    expect(result.current.config.rate).toBe(30);
  });

  it('setConfig clamps depth / chestExpansion / shoulderMovement to [0, 1]', () => {
    const { result } = renderHook(() => useBreathing());
    act(() => {
      result.current.setConfig({
        depth: 2,
        chestExpansion: -1,
        shoulderMovement: 5,
      });
    });
    expect(result.current.config.depth).toBe(1);
    expect(result.current.config.chestExpansion).toBe(0);
    expect(result.current.config.shoulderMovement).toBe(1);
  });

  it('reset returns to defaults', () => {
    const { result } = renderHook(() => useBreathing());
    act(() => {
      result.current.setConfig({ rate: 20, depth: 0.9 });
    });
    expect(result.current.config.rate).toBe(20);

    act(() => {
      result.current.reset();
    });
    expect(result.current.config.rate).toBe(12);
    expect(result.current.config.depth).toBe(0.5);
  });
});

// ---------------------------------------------------------------------------
// useBlinking
// ---------------------------------------------------------------------------

describe('useBlinking', () => {
  it('starts with default blinking config', () => {
    const { result } = renderHook(() => useBlinking());
    expect(result.current.config.frequency).toBe(15);
    expect(result.current.config.minDuration).toBe(0.1);
    expect(result.current.config.maxDuration).toBe(0.2);
  });

  it('setConfig clamps frequency to [1, 60]', () => {
    const { result } = renderHook(() => useBlinking());
    act(() => {
      result.current.setConfig({ frequency: 0 });
    });
    expect(result.current.config.frequency).toBe(1);

    act(() => {
      result.current.setConfig({ frequency: 99 });
    });
    expect(result.current.config.frequency).toBe(60);
  });

  it('setConfig enforces minDuration >= 0.05 and max >= min', () => {
    const { result } = renderHook(() => useBlinking());
    act(() => {
      result.current.setConfig({ minDuration: 0.01, maxDuration: 0.005 });
    });
    expect(result.current.config.minDuration).toBe(0.05);
    expect(result.current.config.maxDuration).toBe(0.05);
  });

  it('reset returns to defaults', () => {
    const { result } = renderHook(() => useBlinking());
    act(() => {
      result.current.setConfig({ frequency: 30, randomize: false });
    });
    act(() => {
      result.current.reset();
    });
    expect(result.current.config.frequency).toBe(15);
    expect(result.current.config.randomize).toBe(true);
  });
});
