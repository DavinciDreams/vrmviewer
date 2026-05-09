import React, { useState } from 'react';
import { cameraManager } from '../../core/three/scene/CameraManager';

export interface CameraControlsProps {
  disabled?: boolean;
}

export const CameraControls: React.FC<CameraControlsProps> = ({ disabled = false }) => {
  const [panSpeed, setPanSpeed] = useState(1.0);
  const [rotateSpeed, setRotateSpeed] = useState(1.0);
  const [zoomSpeed, setZoomSpeed] = useState(1.0);

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
          <label className="text-sm text-gray-300">Pan Speed</label>
          <span className="text-sm text-blue-400 font-mono">{panSpeed.toFixed(1)}</span>
        </div>
        <input
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
          <label className="text-sm text-gray-300">Rotate Speed</label>
          <span className="text-sm text-blue-400 font-mono">{rotateSpeed.toFixed(1)}</span>
        </div>
        <input
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
          <label className="text-sm text-gray-300">Zoom Speed</label>
          <span className="text-sm text-blue-400 font-mono">{zoomSpeed.toFixed(1)}</span>
        </div>
        <input
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
    </div>
  );
};
