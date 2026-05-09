import React, { useEffect, useState } from 'react';
import { lightingManager } from '../../core/three/scene/LightingManager';

export interface LightingPanelProps {
  disabled?: boolean;
}

/**
 * Lighting control panel — surfaces ambient/directional intensities and an
 * optional rim light. Drives the `LightingManager` singleton initialized by
 * `VRMViewer` when the canvas mounts.
 *
 * Local React state mirrors the manager so sliders are responsive; on mount
 * we read the manager's current values if the manager exists.
 */
export const LightingPanel: React.FC<LightingPanelProps> = ({ disabled = false }) => {
  // Initialise from the manager's current lights so the sliders match what
  // the user actually sees on screen rather than arbitrary defaults.
  const initial = (() => {
    if (!lightingManager) {
      return { ambient: 0.6, directional: 0.8, rimEnabled: false, rimIntensity: 0.5 };
    }
    return {
      ambient: lightingManager.getAmbientLight().intensity,
      directional: lightingManager.getDirectionalLight().intensity,
      rimEnabled: !!lightingManager.getRimLight(),
      rimIntensity: lightingManager.getRimLight()?.intensity ?? 0.5,
    };
  })();

  const [ambient, setAmbient] = useState(initial.ambient);
  const [directional, setDirectional] = useState(initial.directional);
  const [rimEnabled, setRimEnabled] = useState(initial.rimEnabled);
  const [rimIntensity, setRimIntensity] = useState(initial.rimIntensity);

  // Re-sync from the manager every time the panel mounts. The IIFE above
  // runs at construction time, but the manager may be null then (canvas
  // not yet mounted) or its values may have been mutated externally (DAM
  // URL params applied via `useDAMIntegration` after this panel was first
  // rendered). Empty-deps subscribe-on-mount is the documented escape
  // hatch for syncing external state.
  useEffect(() => {
    if (!lightingManager) return;
    /* eslint-disable react-hooks/set-state-in-effect -- canonical
       subscribe-to-external-state-on-mount; values come from the
       imperatively-managed Three.js LightingManager singleton. */
    setAmbient(lightingManager.getAmbientLight().intensity);
    setDirectional(lightingManager.getDirectionalLight().intensity);
    const rim = lightingManager.getRimLight();
    setRimEnabled(!!rim);
    if (rim) {
      setRimIntensity(rim.intensity);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const handleAmbient = (value: number) => {
    setAmbient(value);
    lightingManager?.setAmbientIntensity(value);
  };

  const handleDirectional = (value: number) => {
    setDirectional(value);
    lightingManager?.setDirectionalIntensity(value);
  };

  const handleRimToggle = (enabled: boolean) => {
    setRimEnabled(enabled);
    if (!lightingManager) return;
    if (enabled) {
      lightingManager.addRimLight(0xffffff, rimIntensity);
    } else {
      lightingManager.removeRimLight();
    }
  };

  const handleRimIntensity = (value: number) => {
    setRimIntensity(value);
    if (!lightingManager) return;
    if (rimEnabled) {
      // addRimLight replaces the existing rim light, applying the new intensity.
      lightingManager.addRimLight(0xffffff, value);
    }
  };

  return (
    <div className="bg-gray-800/90 backdrop-blur-sm rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-white font-medium">Lighting</h3>
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <label className="text-sm text-gray-300">Ambient</label>
          <span className="text-sm text-blue-400 font-mono">{ambient.toFixed(2)}</span>
        </div>
        <input
          type="range"
          min="0"
          max="2"
          step="0.05"
          value={ambient}
          onChange={(e) => handleAmbient(parseFloat(e.target.value))}
          disabled={disabled}
          className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
        />
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <label className="text-sm text-gray-300">Directional</label>
          <span className="text-sm text-blue-400 font-mono">{directional.toFixed(2)}</span>
        </div>
        <input
          type="range"
          min="0"
          max="3"
          step="0.05"
          value={directional}
          onChange={(e) => handleDirectional(parseFloat(e.target.value))}
          disabled={disabled}
          className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
        />
      </div>

      {/* Rim light */}
      <div className="space-y-2 pt-2 border-t border-gray-700">
        <div className="flex items-center justify-between">
          <label className="text-sm text-gray-300">Rim light</label>
          <input
            type="checkbox"
            checked={rimEnabled}
            onChange={(e) => handleRimToggle(e.target.checked)}
            disabled={disabled}
            className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500 disabled:opacity-50"
          />
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">Intensity</span>
            <span className="text-xs text-blue-400 font-mono">{rimIntensity.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min="0"
            max="2"
            step="0.05"
            value={rimIntensity}
            onChange={(e) => handleRimIntensity(parseFloat(e.target.value))}
            disabled={disabled || !rimEnabled}
            className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
          />
        </div>
      </div>
    </div>
  );
};
