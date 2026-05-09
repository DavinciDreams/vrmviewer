import React from 'react';
import { useBlendShapes } from '../../hooks/useBlendShapes';
import { ExpressionPresets, ExpressionPresetName } from '../../constants/blendShapes';

export interface ExpressionPanelProps {
  disabled?: boolean;
}

const PRESET_KEYS = Object.keys(ExpressionPresets) as ExpressionPresetName[];

/**
 * Expression / blend-shape control panel.
 *
 * Drives the `BlendShapeManager` (via `useBlendShapes`) so changes here
 * mutate the actually-rendered VRM. Surfaces the seven preset emotions
 * defined in `constants/blendShapes.ts` plus per-shape sliders for
 * whatever blend shapes the loaded model exposes.
 */
export const ExpressionPanel: React.FC<ExpressionPanelProps> = ({ disabled = false }) => {
  const {
    availableBlendShapes,
    currentBlendShapes,
    currentExpression,
    expressionWeight,
    setBlendShape,
    setExpression,
    clearExpression,
    resetBlendShapes,
  } = useBlendShapes();

  const handlePresetClick = (preset: ExpressionPresetName) => {
    if (currentExpression === preset) {
      clearExpression();
    } else {
      setExpression(preset, expressionWeight || 1);
    }
  };

  const handleWeightChange = (weight: number) => {
    if (currentExpression) {
      setExpression(currentExpression, weight);
    }
  };

  return (
    <div className="bg-gray-800/90 backdrop-blur-sm rounded-lg p-4 space-y-4 max-h-[28rem] overflow-y-auto">
      <div className="flex items-center justify-between">
        <h3 className="text-white font-medium">Expression</h3>
        <button
          onClick={resetBlendShapes}
          disabled={disabled}
          className="text-xs text-gray-400 hover:text-white disabled:opacity-50"
        >
          Reset
        </button>
      </div>

      {/* Preset buttons */}
      <div className="grid grid-cols-2 gap-2">
        {PRESET_KEYS.map((preset) => {
          const isActive = currentExpression === preset;
          return (
            <button
              key={preset}
              onClick={() => handlePresetClick(preset)}
              disabled={disabled}
              className={`px-2 py-1.5 text-xs rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
              }`}
            >
              {ExpressionPresets[preset].name}
            </button>
          );
        })}
      </div>

      {/* Expression weight slider (only when an expression is active) */}
      {currentExpression && (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-xs text-gray-300">Weight</label>
            <span className="text-xs text-blue-400 font-mono">{expressionWeight.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={expressionWeight}
            onChange={(e) => handleWeightChange(parseFloat(e.target.value))}
            disabled={disabled}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
          />
        </div>
      )}

      {/* Per-shape sliders */}
      {availableBlendShapes.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-gray-700">
          <p className="text-xs text-gray-400 mb-1">Individual shapes</p>
          {availableBlendShapes.map((name) => {
            const value = currentBlendShapes[name] ?? 0;
            return (
              <div key={name} className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-gray-300 capitalize">{name}</label>
                  <span className="text-xs text-blue-400 font-mono">{value.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={value}
                  onChange={(e) => setBlendShape(name, parseFloat(e.target.value))}
                  disabled={disabled}
                  className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
