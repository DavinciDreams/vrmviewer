import React, { useId, useState } from 'react';
import { cameraManager } from '../../core/three/scene/CameraManager';
import { useCameraPresets } from '../../hooks/useCameraPresets';

export interface CameraControlsProps {
  disabled?: boolean;
}

export const CameraControls: React.FC<CameraControlsProps> = ({ disabled = false }) => {
  const [panSpeed, setPanSpeed] = useState(1.0);
  const [rotateSpeed, setRotateSpeed] = useState(1.0);
  const [zoomSpeed, setZoomSpeed] = useState(1.0);
  const [newPresetName, setNewPresetName] = useState('');
  const [presetError, setPresetError] = useState<string | null>(null);
  const panId = useId();
  const rotateId = useId();
  const zoomId = useId();
  const presetInputId = useId();
  const { presets, savePreset, applyPreset, deletePreset } = useCameraPresets();
  const presetNames = Object.keys(presets).sort();

  const handleSavePreset = async () => {
    setPresetError(null);
    const ok = await savePreset(newPresetName);
    if (!ok) {
      setPresetError(
        newPresetName.trim()
          ? 'Name is reserved or save failed'
          : 'Name is required',
      );
      return;
    }
    setNewPresetName('');
  };

  const handlePanSpeedChange = (value: number) => {
    const speed = parseFloat(value.toFixed(1));
    setPanSpeed(speed);
    if (cameraManager) {
      cameraManager.setPanSpeed(speed);
    }
  };

  const handleRotateSpeedChange = (value: number) => {
    const speed = parseFloat(value.toFixed(1));
    setRotateSpeed(speed);
    if (cameraManager) {
      cameraManager.setRotateSpeed(speed);
    }
  };

  const handleZoomSpeedChange = (value: number) => {
    const speed = parseFloat(value.toFixed(1));
    setZoomSpeed(speed);
    if (cameraManager) {
      cameraManager.setZoomSpeed(speed);
    }
  };

  return (
    <div className="bg-gray-800/90 backdrop-blur-sm rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-white font-medium">Camera Controls</h3>
      </div>

      {/* Pan Speed Control */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label htmlFor={panId} className="text-sm text-gray-300">Pan Speed</label>
          <span className="text-sm text-blue-400 font-mono">{panSpeed.toFixed(1)}</span>
        </div>
        <input
          id={panId}
          type="range"
          min="0.1"
          max="5.0"
          step="0.1"
          value={panSpeed}
          onChange={(e) => handlePanSpeedChange(parseFloat(e.target.value))}
          disabled={disabled}
          className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <div className="flex justify-between text-xs text-gray-500">
          <span>0.1</span>
          <span>5.0</span>
        </div>
      </div>

      {/* Rotate Speed Control */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label htmlFor={rotateId} className="text-sm text-gray-300">Rotate Speed</label>
          <span className="text-sm text-blue-400 font-mono">{rotateSpeed.toFixed(1)}</span>
        </div>
        <input
          id={rotateId}
          type="range"
          min="0.1"
          max="5.0"
          step="0.1"
          value={rotateSpeed}
          onChange={(e) => handleRotateSpeedChange(parseFloat(e.target.value))}
          disabled={disabled}
          className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <div className="flex justify-between text-xs text-gray-500">
          <span>0.1</span>
          <span>5.0</span>
        </div>
      </div>

      {/* Zoom Speed Control */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label htmlFor={zoomId} className="text-sm text-gray-300">Zoom Speed</label>
          <span className="text-sm text-blue-400 font-mono">{zoomSpeed.toFixed(1)}</span>
        </div>
        <input
          id={zoomId}
          type="range"
          min="0.1"
          max="5.0"
          step="0.1"
          value={zoomSpeed}
          onChange={(e) => handleZoomSpeedChange(parseFloat(e.target.value))}
          disabled={disabled}
          className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <div className="flex justify-between text-xs text-gray-500">
          <span>0.1</span>
          <span>5.0</span>
        </div>
      </div>

      {/* Presets — save the current camera position under a user-chosen name
          so the DAM URL (?camera=preset:my-name) can target it. Built-in
          names (front / side / top / default / back) are reserved. */}
      <div className="pt-3 mt-2 border-t border-gray-700 space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-gray-300">Saved Presets</h4>
        </div>

        <div className="flex gap-2">
          <input
            id={presetInputId}
            type="text"
            value={newPresetName}
            onChange={(e) => {
              setNewPresetName(e.target.value);
              if (presetError) setPresetError(null);
            }}
            placeholder="Preset name"
            aria-label="New preset name"
            disabled={disabled}
            className="flex-1 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          />
          <button
            type="button"
            onClick={handleSavePreset}
            disabled={disabled || !newPresetName.trim()}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Save current
          </button>
        </div>
        {presetError && (
          <p className="text-xs text-red-400" role="alert">{presetError}</p>
        )}

        {presetNames.length === 0 ? (
          <p className="text-xs text-gray-500">
            No saved presets yet. Frame the shot you want and click "Save current".
          </p>
        ) : (
          <ul className="space-y-1">
            {presetNames.map((name) => (
              <li key={name} className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => applyPreset(name)}
                  disabled={disabled}
                  className="flex-1 text-left px-2 py-1 text-sm text-gray-200 bg-gray-700/60 hover:bg-gray-700 rounded disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  title="Apply this preset"
                >
                  {name}
                </button>
                <button
                  type="button"
                  onClick={() => deletePreset(name)}
                  aria-label={`Delete preset "${name}"`}
                  className="px-2 py-1 text-xs text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
