/**
 * useIdleAnimation Hook
 * Custom hook for idle animation control (breathing, blinking).
 *
 * Delegates to the `IdleAnimationController` instance owned by
 * `animationStore`. The controller is initialized inside `useVRM` once a
 * VRM model loads, and its `update()` method is driven by `VRMViewer`'s
 * render loop, so toggling start/stop and tweaking breathing/blinking
 * here actually affects the rendered avatar.
 */

import { useCallback, useState } from 'react';
import { useAnimationStore } from '../store/animationStore';
import { IdleAnimationController } from '../core/three/animation/IdleAnimationController';

/**
 * Breathing configuration
 */
export interface BreathingConfig {
  enabled: boolean;
  rate: number; // breaths per minute
  depth: number; // 0-1
  chestExpansion: number; // 0-1
  shoulderMovement: number; // 0-1
}

/**
 * Blinking configuration
 */
export interface BlinkingConfig {
  enabled: boolean;
  frequency: number; // blinks per minute
  minDuration: number; // seconds
  maxDuration: number; // seconds
  randomize: boolean;
}

/**
 * Idle animation hook return type
 */
export interface IdleAnimationControls {
  // State
  breathing: BreathingConfig;
  blinking: BlinkingConfig;
  isRunning: boolean;

  // Actions
  start: () => void;
  stop: () => void;
  setBreathingEnabled: (enabled: boolean) => void;
  setBreathingRate: (rate: number) => void;
  setBreathingDepth: (depth: number) => void;
  setBlinkingEnabled: (enabled: boolean) => void;
  setBlinkingFrequency: (frequency: number) => void;
  setBlinkingDuration: (min: number, max: number) => void;
  setRandomizeBlinking: (randomize: boolean) => void;
  toggle: () => void;
}

const defaultBreathingConfig: BreathingConfig = {
  enabled: true,
  rate: 12,
  depth: 0.5,
  chestExpansion: 0.02,
  shoulderMovement: 0.01,
};

const defaultBlinkingConfig: BlinkingConfig = {
  enabled: true,
  frequency: 15,
  minDuration: 0.1,
  maxDuration: 0.2,
  randomize: true,
};

export function useIdleAnimation(): IdleAnimationControls {
  const idleController = useAnimationStore((s) => s.idleAnimationController);

  // Mirror controller state for reactivity. Initialized to defaults so the
  // UI is meaningful before a model is loaded.
  const [breathing, setBreathing] = useState<BreathingConfig>(defaultBreathingConfig);
  const [blinking, setBlinking] = useState<BlinkingConfig>(defaultBlinkingConfig);
  const [isRunning, setIsRunning] = useState<boolean>(true);

  // Sync local React state with controller state whenever the controller
  // identity changes (e.g. a new model is loaded). Tracking the last-seen
  // controller via useState (not useRef) is the React-docs-recommended
  // pattern for "adjust state during render" without hitting
  // setState-in-effect or ref-in-render lint rules.
  const [lastController, setLastController] = useState<IdleAnimationController | null>(idleController ?? null);
  if (lastController !== idleController) {
    setLastController(idleController ?? null);
    if (idleController && idleController.isInitialized()) {
      const state = idleController.getState();
      setBreathing(state.breathing);
      setBlinking(state.blinking);
      setIsRunning(state.isRunning);
    }
  }

  const start = useCallback(() => {
    idleController?.start();
    setIsRunning(true);
  }, [idleController]);

  const stop = useCallback(() => {
    idleController?.stop();
    setIsRunning(false);
  }, [idleController]);

  const toggle = useCallback(() => {
    if (isRunning) {
      idleController?.stop();
      setIsRunning(false);
    } else {
      idleController?.start();
      setIsRunning(true);
    }
  }, [idleController, isRunning]);

  const setBreathingEnabled = useCallback((enabled: boolean) => {
    // Just update the sub-feature flag. Don't override the user's explicit
    // Run/Stop state — if they hit Stop and then toggle breathing on, leave
    // the controller stopped. They can hit Run again themselves.
    idleController?.setBreathingConfig({ enabled });
    setBreathing((prev) => ({ ...prev, enabled }));
  }, [idleController]);

  const setBreathingRate = useCallback((rate: number) => {
    const clamped = Math.max(1, Math.min(30, rate));
    idleController?.setBreathingConfig({ rate: clamped });
    setBreathing((prev) => ({ ...prev, rate: clamped }));
  }, [idleController]);

  const setBreathingDepth = useCallback((depth: number) => {
    const clamped = Math.max(0, Math.min(1, depth));
    idleController?.setBreathingConfig({ depth: clamped });
    setBreathing((prev) => ({ ...prev, depth: clamped }));
  }, [idleController]);

  const setBlinkingEnabled = useCallback((enabled: boolean) => {
    // See `setBreathingEnabled` — sub-feature toggles never override the
    // top-level Run/Stop state.
    idleController?.setBlinkingConfig({ enabled });
    setBlinking((prev) => ({ ...prev, enabled }));
  }, [idleController]);

  const setBlinkingFrequency = useCallback((frequency: number) => {
    const clamped = Math.max(1, Math.min(60, frequency));
    idleController?.setBlinkingConfig({ frequency: clamped });
    setBlinking((prev) => ({ ...prev, frequency: clamped }));
  }, [idleController]);

  const setBlinkingDuration = useCallback((min: number, max: number) => {
    const clampedMin = Math.max(0.05, min);
    const clampedMax = Math.max(clampedMin, max);
    idleController?.setBlinkingConfig({ minDuration: clampedMin, maxDuration: clampedMax });
    setBlinking((prev) => ({
      ...prev,
      minDuration: clampedMin,
      maxDuration: clampedMax,
    }));
  }, [idleController]);

  const setRandomizeBlinking = useCallback((randomize: boolean) => {
    idleController?.setBlinkingConfig({ randomize });
    setBlinking((prev) => ({ ...prev, randomize }));
  }, [idleController]);

  return {
    breathing,
    blinking,
    isRunning,
    start,
    stop,
    setBreathingEnabled,
    setBreathingRate,
    setBreathingDepth,
    setBlinkingEnabled,
    setBlinkingFrequency,
    setBlinkingDuration,
    setRandomizeBlinking,
    toggle,
  };
}

/**
 * useBreathing — independent breathing-only state for non-shared UI.
 */
export function useBreathing(): {
  config: BreathingConfig;
  setConfig: (config: Partial<BreathingConfig>) => void;
  reset: () => void;
} {
  const [config, setConfig] = useState<BreathingConfig>(defaultBreathingConfig);

  const setPartialConfig = useCallback((partialConfig: Partial<BreathingConfig>) => {
    setConfig((prev) => {
      const newConfig = { ...prev, ...partialConfig };
      if (newConfig.rate !== undefined) {
        newConfig.rate = Math.max(1, Math.min(30, newConfig.rate));
      }
      if (newConfig.depth !== undefined) {
        newConfig.depth = Math.max(0, Math.min(1, newConfig.depth));
      }
      if (newConfig.chestExpansion !== undefined) {
        newConfig.chestExpansion = Math.max(0, Math.min(1, newConfig.chestExpansion));
      }
      if (newConfig.shoulderMovement !== undefined) {
        newConfig.shoulderMovement = Math.max(0, Math.min(1, newConfig.shoulderMovement));
      }
      return newConfig;
    });
  }, []);

  const reset = useCallback(() => {
    setConfig(defaultBreathingConfig);
  }, []);

  return {
    config,
    setConfig: setPartialConfig,
    reset,
  };
}

/**
 * useBlinking — independent blinking-only state for non-shared UI.
 */
export function useBlinking(): {
  config: BlinkingConfig;
  setConfig: (config: Partial<BlinkingConfig>) => void;
  reset: () => void;
} {
  const [config, setConfig] = useState<BlinkingConfig>(defaultBlinkingConfig);

  const setPartialConfig = useCallback((partialConfig: Partial<BlinkingConfig>) => {
    setConfig((prev) => {
      const newConfig = { ...prev, ...partialConfig };
      if (newConfig.frequency !== undefined) {
        newConfig.frequency = Math.max(1, Math.min(60, newConfig.frequency));
      }
      if (newConfig.minDuration !== undefined) {
        newConfig.minDuration = Math.max(0.05, newConfig.minDuration);
      }
      if (newConfig.maxDuration !== undefined) {
        newConfig.maxDuration = Math.max(newConfig.minDuration, newConfig.maxDuration);
      }
      return newConfig;
    });
  }, []);

  const reset = useCallback(() => {
    setConfig(defaultBlinkingConfig);
  }, []);

  return {
    config,
    setConfig: setPartialConfig,
    reset,
  };
}
