/**
 * useBlendShapes Hook
 * Custom hook for blend shape management
 */

import { useCallback, useEffect, useState } from 'react';
import { ExpressionPresetName } from '../constants/blendShapes';

/**
 * Blend shape hook return type
 */
export interface BlendShapeControls {
  // State
  availableBlendShapes: string[];
  currentBlendShapes: Record<string, number>;
  currentExpression: ExpressionPresetName | null;
  expressionWeight: number;

  // Actions
  setBlendShape: (name: string, value: number) => void;
  setBlendShapes: (blendShapes: Record<string, number>) => void;
  setExpression: (preset: ExpressionPresetName, weight?: number) => void;
  clearExpression: () => void;
  resetBlendShapes: () => void;
  getBlendShape: (name: string) => number;
  hasBlendShape: (name: string) => boolean;
}

/**
 * useBlendShapes hook
 * Note: This is a placeholder implementation. In a real implementation,
 * you would integrate with the BlendShapeManager from the animation system.
 */
export function useBlendShapes(): BlendShapeControls {
  // State
  const [availableBlendShapes, setAvailableBlendShapes] = useState<string[]>([]);
  const [currentBlendShapes, setCurrentBlendShapes] = useState<Record<string, number>>({});
  const [currentExpression, setCurrentExpression] = useState<ExpressionPresetName | null>(null);
  const [expressionWeight, setExpressionWeight] = useState<number>(1);

  // Set blend shape value
  const setBlendShape = useCallback((name: string, value: number) => {
    setCurrentBlendShapes((prev) => ({
      ...prev,
      [name]: Math.max(0, Math.min(1, value)),
    }));
  }, []);

  // Set multiple blend shapes
  const setBlendShapes = useCallback((blendShapes: Record<string, number>) => {
    const normalized: Record<string, number> = {};
    Object.entries(blendShapes).forEach(([name, value]) => {
      normalized[name] = Math.max(0, Math.min(1, value));
    });
    setCurrentBlendShapes(normalized);
  }, []);

  // Set expression preset
  const setExpression = useCallback((preset: ExpressionPresetName, weight: number = 1) => {
    setCurrentExpression(preset);
    setExpressionWeight(Math.max(0, Math.min(1, weight)));

    // In a real implementation, this would apply the preset blend shapes
    // For now, we'll just clear current blend shapes
    setCurrentBlendShapes({});
  }, []);

  // Clear expression
  const clearExpression = useCallback(() => {
    setCurrentExpression(null);
    setExpressionWeight(1);
    setCurrentBlendShapes({});
  }, []);

  // Reset all blend shapes
  const resetBlendShapes = useCallback(() => {
    setCurrentBlendShapes({});
    setCurrentExpression(null);
    setExpressionWeight(1);
  }, []);

  // Get blend shape value
  const getBlendShape = useCallback((name: string): number => {
    return currentBlendShapes[name] ?? 0;
  }, [currentBlendShapes]);

  // Check if blend shape is available
  const hasBlendShape = useCallback((name: string): boolean => {
    return availableBlendShapes.includes(name);
  }, [availableBlendShapes]);

  // Initialize available blend shapes (placeholder)
  useEffect(() => {
    // In a real implementation, this would get available blend shapes from the VRM model
    const defaultBlendShapes = [
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
    setAvailableBlendShapes(defaultBlendShapes);
  }, []);

  return {
    // State
    availableBlendShapes,
    currentBlendShapes,
    currentExpression,
    expressionWeight,

    // Actions
    setBlendShape,
    setBlendShapes,
    setExpression,
    clearExpression,
    resetBlendShapes,
    getBlendShape,
    hasBlendShape,
  };
}

/**
 * useBlendShapeValue hook
 * Get and set a specific blend shape value
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
 * useExpression hook
 * Get and set expression preset
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
