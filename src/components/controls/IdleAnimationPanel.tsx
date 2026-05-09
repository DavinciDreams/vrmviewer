import React from 'react';
import { useIdleAnimation } from '../../hooks/useIdleAnimation';

export interface IdleAnimationPanelProps {
  disabled?: boolean;
}

/**
 * Idle animation control panel — breathing rate/depth, blink frequency.
 *
 * Drives the `IdleAnimationController` (via `useIdleAnimation`) so changes
 * mutate the rendered avatar's idle motion in real time.
 */
export const IdleAnimationPanel: React.FC<IdleAnimationPanelProps> = ({ disabled = false }) => {
  const {
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
  } = useIdleAnimation();

  return (
    <div className="bg-gray-800/90 backdrop-blur-sm rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-white font-medium">Idle Motion</h3>
        <button
          onClick={() => (isRunning ? stop() : start())}
          disabled={disabled}
          className={`px-2 py-1 text-xs rounded transition-colors disabled:opacity-50 ${
            isRunning
              ? 'bg-green-600 text-white hover:bg-green-700'
              : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
          }`}
        >
          {isRunning ? 'Running' : 'Stopped'}
        </button>
      </div>

      {/* Breathing */}
      <div className="space-y-2 pb-3 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <label className="text-sm text-gray-300">Breathing</label>
          <input
            type="checkbox"
            checked={breathing.enabled}
            onChange={(e) => setBreathingEnabled(e.target.checked)}
            disabled={disabled}
            className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500 disabled:opacity-50"
          />
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">Rate (bpm)</span>
            <span className="text-xs text-blue-400 font-mono">{breathing.rate}</span>
          </div>
          <input
            type="range"
            min="1"
            max="30"
            step="1"
            value={breathing.rate}
            onChange={(e) => setBreathingRate(parseFloat(e.target.value))}
            disabled={disabled || !breathing.enabled}
            className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
          />
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">Depth</span>
            <span className="text-xs text-blue-400 font-mono">{breathing.depth.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={breathing.depth}
            onChange={(e) => setBreathingDepth(parseFloat(e.target.value))}
            disabled={disabled || !breathing.enabled}
            className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
          />
        </div>
      </div>

      {/* Blinking */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm text-gray-300">Blinking</label>
          <input
            type="checkbox"
            checked={blinking.enabled}
            onChange={(e) => setBlinkingEnabled(e.target.checked)}
            disabled={disabled}
            className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500 disabled:opacity-50"
          />
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">Frequency (per min)</span>
            <span className="text-xs text-blue-400 font-mono">{blinking.frequency}</span>
          </div>
          <input
            type="range"
            min="1"
            max="60"
            step="1"
            value={blinking.frequency}
            onChange={(e) => setBlinkingFrequency(parseFloat(e.target.value))}
            disabled={disabled || !blinking.enabled}
            className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
          />
        </div>
      </div>
    </div>
  );
};
