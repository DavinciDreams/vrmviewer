import React from 'react';
import { useBlendShapes } from '../../hooks/useBlendShapes';
import {
  ExpressionPresets,
  ExpressionPresetName,
  LipSyncBlendShapes,
  LipSyncVisemeName,
} from '../../constants/blendShapes';

export interface ExpressionPanelProps {
  disabled?: boolean;
}

const PRESET_KEYS = Object.keys(ExpressionPresets) as ExpressionPresetName[];
const VISEME_KEYS = Object.keys(LipSyncBlendShapes) as LipSyncVisemeName[];

/**
 * Expression / blend-shape control panel.
 *
 * Drives the `BlendShapeManager` (via `useBlendShapes`) so changes here
 * mutate the actually-rendered VRM. Surfaces three layers of facial
 * control: emotion presets, lip-sync visemes, and per-eye blink — plus
 * raw per-shape sliders for whatever the model exposes.
 */
export const ExpressionPanel: React.FC<ExpressionPanelProps> = ({ disabled = false }) => {
  const {
    availableBlendShapes,
    currentBlendShapes,
    currentExpression,
    expressionWeight,
    currentLipSync,
    lipSyncWeight,
    eyeBlink,
    setBlendShape,
    setExpression,
    clearExpression,
    setLipSync,
    clearLipSync,
    setEyeBlink,
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

  const handleVisemeClick = (viseme: LipSyncVisemeName) => {
    if (currentLipSync === viseme) {
      clearLipSync();
    } else {
      setLipSync(viseme, lipSyncWeight || 1);
    }
  };

  const handleLipSyncWeightChange = (weight: number) => {
    if (currentLipSync) {
      setLipSync(currentLipSync, weight);
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

      {/* Lip-sync visemes */}
      <div className="space-y-2 pt-2 border-t border-gray-700">
        <p className="text-xs text-gray-400 mb-1">Lip sync</p>
        <div className="grid grid-cols-3 gap-1.5">
          {VISEME_KEYS.map((viseme) => {
            const isActive = currentLipSync === viseme;
            return (
              <button
                key={viseme}
                onClick={() => handleVisemeClick(viseme)}
                disabled={disabled}
                className={`px-1 py-1 text-xs rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                }`}
              >
                {LipSyncBlendShapes[viseme].name}
              </button>
            );
          })}
        </div>
        {currentLipSync && (
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs text-gray-300">Viseme weight</label>
              <span className="text-xs text-blue-400 font-mono">{lipSyncWeight.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={lipSyncWeight}
              onChange={(e) => handleLipSyncWeightChange(parseFloat(e.target.value))}
              disabled={disabled}
              className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
            />
          </div>
        )}
      </div>

      {/* Eye blink — per-eye + both. Independent of the expression preset so
          you can pose a wink without disturbing the active emotion. */}
      <div className="space-y-2 pt-2 border-t border-gray-700">
        <p className="text-xs text-gray-400 mb-1">Eye blink</p>
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-xs text-gray-300">Left eye</label>
            <span className="text-xs text-blue-400 font-mono">{eyeBlink.left.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={eyeBlink.left}
            onChange={(e) => setEyeBlink(parseFloat(e.target.value), eyeBlink.right)}
            disabled={disabled}
            className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
          />
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-xs text-gray-300">Right eye</label>
            <span className="text-xs text-blue-400 font-mono">{eyeBlink.right.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={eyeBlink.right}
            onChange={(e) => setEyeBlink(eyeBlink.left, parseFloat(e.target.value))}
            disabled={disabled}
            className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
          />
        </div>
      </div>

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
