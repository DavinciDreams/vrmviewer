/**
 * useIdleAnimation Hook
 * Custom hook for idle animation control (breathing, blinking)
 */

import { useCallback, useEffect, useState } from 'react';

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
 * Idle animation state
 */
export interface IdleAnimationState {
  breathing: BreathingConfig;
  blinking: BlinkingConfig;
  isRunning: boolean;
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

/**
 * Default breathing configuration
 */
const defaultBreathingConfig: BreathingConfig = {
  enabled: true,
  rate: 12, // 12 breaths per minute (average)
  depth: 0.5,
  chestExpansion: 0.02,
  shoulderMovement: 0.01,
};

/**
 * Default blinking configuration
 */
const defaultBlinkingConfig: BlinkingConfig = {
  enabled: true,
  frequency: 15, // 15 blinks per minute (average)
  minDuration: 0.1,
  maxDuration: 0.2,
  randomize: true,
};

/**
 * useIdleAnimation hook
 * Note: This is a placeholder implementation. In a real implementation,
 * you would integrate with IdleAnimationController from animation system.
 */
export function useIdleAnimation(): IdleAnimationControls {
  // State
  const [breathing, setBreathing] = useState<BreathingConfig>(defaultBreathingConfig);
  const [blinking, setBlinking] = useState<BlinkingConfig>(defaultBlinkingConfig);
  const [isRunning, setIsRunning] = useState<boolean>(false);

  // Start idle animations
  const start = useCallback(() => {
    setIsRunning(true);
  }, []);

  // Stop idle animations
  const stop = useCallback(() => {
    setIsRunning(false);
  }, []);

  // Toggle idle animations
  const toggle = useCallback(() => {
    setIsRunning((prev) => !prev);
  }, []);

  // Set breathing enabled
  const setBreathingEnabled = useCallback((enabled: boolean) => {
    setBreathing((prev) => ({ ...prev, enabled }));
  }, []);

  // Set breathing rate
  const setBreathingRate = useCallback((rate: number) => {
    setBreathing((prev) => ({ ...prev, rate: Math.max(1, Math.min(30, rate)) }));
  }, []);

  // Set breathing depth
  const setBreathingDepth = useCallback((depth: number) => {
    setBreathing((prev) => ({ ...prev, depth: Math.max(0, Math.min(1, depth)) }));
  }, []);

  // Set blinking enabled
  const setBlinkingEnabled = useCallback((enabled: boolean) => {
    setBlinking((prev) => ({ ...prev, enabled }));
  }, []);

  // Set blinking frequency
  const setBlinkingFrequency = useCallback((frequency: number) => {
    setBlinking((prev) => ({ ...prev, frequency: Math.max(1, Math.min(60, frequency)) }));
  }, []);

  // Set blinking duration
  const setBlinkingDuration = useCallback((min: number, max: number) => {
    setBlinking((prev) => ({
      ...prev,
      minDuration: Math.max(0.05, min),
      maxDuration: Math.max(min, max),
    }));
  }, []);

  // Set randomize blinking
  const setRandomizeBlinking = useCallback((randomize: boolean) => {
    setBlinking((prev) => ({ ...prev, randomize }));
  }, []);

  // Auto-start if enabled
  useEffect(() => {
    if (breathing.enabled || blinking.enabled) {
      setIsRunning(true);
    }
  }, [breathing.enabled, blinking.enabled]);

  return {
    // State
    breathing,
    blinking,
    isRunning,

    // Actions
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
 * useBreathing hook
 * Get and control breathing animation
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
      
      // Validate and clamp values
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
 * useBlinking hook
 * Get and control blinking animation
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
      
      // Validate and clamp values
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
