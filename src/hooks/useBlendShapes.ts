/**
 * useBlendShapes Hook
 * Custom hook for blend shape management.
 *
 * Delegates to the `BlendShapeManager` instance owned by `animationStore`.
 * That manager is initialized inside `useVRM` once a VRM model loads, and
 * its `update()` method is driven by `VRMViewer`'s render loop, so all
 * setter calls here actually mutate the rendered avatar.
 */

import { useCallback, useState } from 'react';
import { useAnimationStore } from '../store/animationStore';
import { ExpressionPresetName, LipSyncVisemeName } from '../constants/blendShapes';
import { BlendShapeManager } from '../core/three/animation/BlendShapeManager';

const DEFAULT_BLEND_SHAPES = [
  'blink',
  'blinkLeft',
  'blinkRight',
  'happy',
  'angry',
  'sad',
  'surprised',
  'aa',
  'ih',
  'ou',
  'ee',
  'oh',
];

/**
 * Blend shape hook return type
 */
export interface BlendShapeControls {
  // State
  availableBlendShapes: string[];
  currentBlendShapes: Record<string, number>;
  currentExpression: ExpressionPresetName | null;
  expressionWeight: number;
  currentLipSync: LipSyncVisemeName | null;
  lipSyncWeight: number;
  eyeBlink: { left: number; right: number };

  // Actions
  setBlendShape: (name: string, value: number) => void;
  setBlendShapes: (blendShapes: Record<string, number>) => void;
  setExpression: (preset: ExpressionPresetName, weight?: number) => void;
  clearExpression: () => void;
  setLipSync: (viseme: LipSyncVisemeName, weight?: number) => void;
  clearLipSync: () => void;
  setEyeBlink: (left: number, right: number) => void;
  setBothEyesBlink: (value: number) => void;
  resetBlendShapes: () => void;
  getBlendShape: (name: string) => number;
  hasBlendShape: (name: string) => boolean;
}

export function useBlendShapes(): BlendShapeControls {
  const blendShapeManager = useAnimationStore((s) => s.blendShapeManager);

  const [availableBlendShapes, setAvailableBlendShapes] = useState<string[]>(DEFAULT_BLEND_SHAPES);
  const [currentBlendShapes, setCurrentBlendShapes] = useState<Record<string, number>>({});
  const [currentExpression, setCurrentExpression] = useState<ExpressionPresetName | null>(null);
  const [expressionWeight, setExpressionWeight] = useState<number>(1);
  const [currentLipSync, setCurrentLipSync] = useState<LipSyncVisemeName | null>(null);
  const [lipSyncWeight, setLipSyncWeight] = useState<number>(1);
  const [eyeBlink, setEyeBlinkState] = useState<{ left: number; right: number }>({ left: 0, right: 0 });

  // Sync local React state with manager state whenever the manager identity
  // changes (e.g. a new model is loaded). Tracking the last-seen manager via
  // useState (not useRef) is the React-docs-recommended pattern for
  // "adjust state during render" without hitting setState-in-effect or
  // ref-in-render lint rules.
  const [lastManager, setLastManager] = useState<BlendShapeManager | null>(blendShapeManager ?? null);
  if (lastManager !== blendShapeManager) {
    setLastManager(blendShapeManager ?? null);
    if (blendShapeManager && blendShapeManager.isInitialized()) {
      const shapes = blendShapeManager.getAvailableBlendShapes();
      const nextAvailable = shapes.length > 0 ? shapes : DEFAULT_BLEND_SHAPES;
      setAvailableBlendShapes(nextAvailable);
      setCurrentBlendShapes(blendShapeManager.getAllBlendShapes());
      const expr = blendShapeManager.getExpression();
      setCurrentExpression(expr ? expr.preset : null);
      setExpressionWeight(expr ? expr.weight : 1);
    } else {
      setAvailableBlendShapes(DEFAULT_BLEND_SHAPES);
      setCurrentBlendShapes({});
      setCurrentExpression(null);
      setExpressionWeight(1);
    }
  }

  const setBlendShape = useCallback((name: string, value: number) => {
    const clamped = Math.max(0, Math.min(1, value));
    blendShapeManager?.setBlendShape(name, clamped);
    setCurrentBlendShapes((prev) => ({ ...prev, [name]: clamped }));
  }, [blendShapeManager]);

  const setBlendShapes = useCallback((blendShapes: Record<string, number>) => {
    const normalized: Record<string, number> = {};
    Object.entries(blendShapes).forEach(([name, value]) => {
      normalized[name] = Math.max(0, Math.min(1, value));
    });
    blendShapeManager?.setBlendShapes(normalized);
    setCurrentBlendShapes(normalized);
  }, [blendShapeManager]);

  const setExpression = useCallback((preset: ExpressionPresetName, weight: number = 1) => {
    const clampedWeight = Math.max(0, Math.min(1, weight));
    if (blendShapeManager) {
      try {
        blendShapeManager.setExpression(preset, clampedWeight);
      } catch (err) {
        console.warn('[useBlendShapes] setExpression failed:', err);
        return;
      }
      setCurrentBlendShapes(blendShapeManager.getAllBlendShapes());
    }
    setCurrentExpression(preset);
    setExpressionWeight(clampedWeight);
  }, [blendShapeManager]);

  const clearExpression = useCallback(() => {
    blendShapeManager?.clearExpression();
    setCurrentExpression(null);
    setExpressionWeight(1);
    setCurrentBlendShapes(blendShapeManager ? blendShapeManager.getAllBlendShapes() : {});
  }, [blendShapeManager]);

  // Lip-sync — delegates to BlendShapeManager.setLipSync / clearLipSync.
  // The manager applies the viseme's per-shape weights internally; we mirror
  // its post-apply state so the per-shape sliders update in lock-step.
  const setLipSync = useCallback((viseme: LipSyncVisemeName, weight: number = 1) => {
    const clampedWeight = Math.max(0, Math.min(1, weight));
    if (blendShapeManager) {
      try {
        blendShapeManager.setLipSync(viseme, clampedWeight);
      } catch (err) {
        console.warn('[useBlendShapes] setLipSync failed:', err);
        return;
      }
      setCurrentBlendShapes(blendShapeManager.getAllBlendShapes());
    }
    setCurrentLipSync(viseme);
    setLipSyncWeight(clampedWeight);
  }, [blendShapeManager]);

  const clearLipSync = useCallback(() => {
    blendShapeManager?.clearLipSync();
    setCurrentLipSync(null);
    setLipSyncWeight(1);
    setCurrentBlendShapes(blendShapeManager ? blendShapeManager.getAllBlendShapes() : {});
  }, [blendShapeManager]);

  // Eye blink — independent of the expression preset system. Per-eye control
  // lets callers wire up winks or per-eye animation drivers without touching
  // the shared blendShapes map.
  const setEyeBlink = useCallback((left: number, right: number) => {
    const clampedLeft = Math.max(0, Math.min(1, left));
    const clampedRight = Math.max(0, Math.min(1, right));
    blendShapeManager?.setEyeBlink(clampedLeft, clampedRight);
    setEyeBlinkState({ left: clampedLeft, right: clampedRight });
    if (blendShapeManager) {
      setCurrentBlendShapes(blendShapeManager.getAllBlendShapes());
    }
  }, [blendShapeManager]);

  const setBothEyesBlink = useCallback((value: number) => {
    const clamped = Math.max(0, Math.min(1, value));
    blendShapeManager?.setBothEyesBlink(clamped);
    setEyeBlinkState({ left: clamped, right: clamped });
    if (blendShapeManager) {
      setCurrentBlendShapes(blendShapeManager.getAllBlendShapes());
    }
  }, [blendShapeManager]);

  const resetBlendShapes = useCallback(() => {
    blendShapeManager?.reset();
    setCurrentBlendShapes({});
    setCurrentExpression(null);
    setExpressionWeight(1);
    setCurrentLipSync(null);
    setLipSyncWeight(1);
    setEyeBlinkState({ left: 0, right: 0 });
  }, [blendShapeManager]);

  const getBlendShape = useCallback((name: string): number => {
    return blendShapeManager?.getBlendShape(name) ?? currentBlendShapes[name] ?? 0;
  }, [blendShapeManager, currentBlendShapes]);

  const hasBlendShape = useCallback((name: string): boolean => {
    if (blendShapeManager?.isInitialized()) {
      return blendShapeManager.hasBlendShape(name);
    }
    return availableBlendShapes.includes(name);
  }, [blendShapeManager, availableBlendShapes]);

  return {
    availableBlendShapes,
    currentBlendShapes,
    currentExpression,
    expressionWeight,
    currentLipSync,
    lipSyncWeight,
    eyeBlink,
    setBlendShape,
    setBlendShapes,
    setExpression,
    clearExpression,
    setLipSync,
    clearLipSync,
    setEyeBlink,
    setBothEyesBlink,
    resetBlendShapes,
    getBlendShape,
    hasBlendShape,
  };
}

/**
 * useBlendShapeValue hook — controlled-input helper for a single shape.
 */
export function useBlendShapeValue(): {
  value: number;
  setValue: (value: number) => void;
} {
  const [value, setValue] = useState<number>(0);

  const setClampedValue = useCallback((newValue: number) => {
    setValue(Math.max(0, Math.min(1, newValue)));
  }, []);

  return {
    value,
    setValue: setClampedValue,
  };
}

/**
 * useExpression hook — independent expression preset state for non-shared UI.
 */
export function useExpression(): {
  currentExpression: ExpressionPresetName | null;
  weight: number;
  setExpression: (preset: ExpressionPresetName, weight?: number) => void;
  clearExpression: () => void;
} {
  const [currentExpression, setCurrentExpression] = useState<ExpressionPresetName | null>(null);
  const [weight, setWeight] = useState<number>(1);

  const setExpressionWithWeight = useCallback((preset: ExpressionPresetName, newWeight: number = 1) => {
    setCurrentExpression(preset);
    setWeight(Math.max(0, Math.min(1, newWeight)));
  }, []);

  const clearExpression = useCallback(() => {
    setCurrentExpression(null);
    setWeight(1);
  }, []);

  return {
    currentExpression,
    weight,
    setExpression: setExpressionWithWeight,
    clearExpression,
  };
}
