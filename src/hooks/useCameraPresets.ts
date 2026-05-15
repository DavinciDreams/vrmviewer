/**
 * useCameraPresets — load / save / apply / delete user-named camera
 * positions, persisted under the `cameraPresets` preference key.
 *
 * Closes the "DAM URL custom camera presets" item from the deferred list:
 * the built-in `front` / `side` / `top` / `default` mappings live in
 * `useDAMIntegration`'s `applyCameraConfig`; this hook + the
 * `resolveCameraPreset` helper extend that with arbitrary user-named
 * presets so the DAM `?camera=preset:my-name` URL can target a custom
 * position too.
 */

import { useCallback, useEffect, useState } from 'react';
import * as THREE from 'three';
import { getPreferencesService } from '../core/database/services/PreferencesService';
import { cameraManager } from '../core/three/scene/CameraManager';

/**
 * Persisted shape of a saved camera position. Mirrors the layout used
 * by the auto-save effect in App.tsx so the same {position, target,
 * zoom} snapshot is interchangeable across the two paths.
 */
export interface CameraPresetSnapshot {
  position: { x: number; y: number; z: number };
  target: { x: number; y: number; z: number };
  zoom: number;
}

export type CameraPresetMap = Record<string, CameraPresetSnapshot>;

const PRESETS_KEY = 'cameraPresets';

/** Built-in preset names — reserved so users can't overwrite them. */
export const BUILTIN_PRESET_NAMES = new Set([
  'front',
  'side',
  'top',
  'default',
  'back', // mentioned in the deferred-list note even though it's not in applyCameraConfig
]);

function captureCurrentSnapshot(): CameraPresetSnapshot | null {
  if (!cameraManager) return null;
  const cam = cameraManager.getCamera();
  const ctrls = cameraManager.getControls();
  return {
    position: { x: cam.position.x, y: cam.position.y, z: cam.position.z },
    target: { x: ctrls.target.x, y: ctrls.target.y, z: ctrls.target.z },
    zoom: cam.zoom,
  };
}

/**
 * Apply a stored snapshot to the live cameraManager. Returns false if
 * the manager is unavailable (e.g. canvas not yet mounted).
 */
export function applyCameraSnapshot(snapshot: CameraPresetSnapshot): boolean {
  if (!cameraManager) return false;
  const cam = cameraManager.getCamera();
  const ctrls = cameraManager.getControls();
  cam.position.set(snapshot.position.x, snapshot.position.y, snapshot.position.z);
  ctrls.target.set(snapshot.target.x, snapshot.target.y, snapshot.target.z);
  if (typeof snapshot.zoom === 'number' && !Number.isNaN(snapshot.zoom)) {
    cam.zoom = snapshot.zoom;
    cam.updateProjectionMatrix();
  }
  ctrls.update();
  return true;
}

/**
 * Apply a named preset. Checks built-ins first (front/side/top/default),
 * then falls through to the user-saved map. Returns true if the preset
 * was found and applied.
 *
 * Exported separately from the hook so callers like `useDAMIntegration`
 * (which already runs outside React render cycles) can use it without
 * mounting the full hook.
 */
export async function resolveCameraPreset(name: string): Promise<boolean> {
  const lower = name.toLowerCase();

  // Built-ins applied via cameraManager directly (matches the existing
  // applyCameraConfig logic in useDAMIntegration).
  if (BUILTIN_PRESET_NAMES.has(lower)) {
    if (!cameraManager) return false;
    switch (lower) {
      case 'front':
        cameraManager.setCameraPosition(new THREE.Vector3(0, 1.5, 3));
        return true;
      case 'back':
        cameraManager.setCameraPosition(new THREE.Vector3(0, 1.5, -3));
        return true;
      case 'side':
        cameraManager.setCameraPosition(new THREE.Vector3(3, 1.5, 0));
        return true;
      case 'top':
        cameraManager.setCameraPosition(new THREE.Vector3(0, 4, 2));
        return true;
      case 'default':
      default:
        cameraManager.resetCamera();
        return true;
    }
  }

  // User-saved preset — look up in the persisted map.
  const result = await getPreferencesService().getPreference<CameraPresetMap>(
    PRESETS_KEY,
  );
  if (!result.success || !result.data) return false;
  const snapshot = result.data[name];
  if (!snapshot) return false;
  return applyCameraSnapshot(snapshot);
}

export interface UseCameraPresetsResult {
  /** Map of saved preset name → snapshot. */
  presets: CameraPresetMap;
  /** True once the initial load from preferences has resolved. */
  isLoaded: boolean;
  /** Save the live camera position under the given name. Returns true on success. */
  savePreset: (name: string) => Promise<boolean>;
  /** Apply a saved preset (by name) to the live camera. */
  applyPreset: (name: string) => boolean;
  /** Delete a saved preset. */
  deletePreset: (name: string) => Promise<void>;
}

export function useCameraPresets(): UseCameraPresetsResult {
  const [presets, setPresets] = useState<CameraPresetMap>({});
  const [isLoaded, setIsLoaded] = useState(false);

  // Load presets from preferences once on mount.
  useEffect(() => {
    let cancelled = false;
    getPreferencesService()
      .getPreference<CameraPresetMap>(PRESETS_KEY)
      .then((result) => {
        if (cancelled) return;
        if (result.success && result.data) {
          setPresets(result.data);
        }
        setIsLoaded(true);
      })
      .catch((err) => {
        if (cancelled) return;
        console.warn('[cameraPresets] load failed:', err);
        setIsLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback(async (next: CameraPresetMap): Promise<boolean> => {
    try {
      await getPreferencesService().setPreference(PRESETS_KEY, next);
      return true;
    } catch (err) {
      console.warn('[cameraPresets] save failed:', err);
      return false;
    }
  }, []);

  const savePreset = useCallback(
    async (name: string): Promise<boolean> => {
      const trimmed = name.trim();
      if (!trimmed) return false;
      if (BUILTIN_PRESET_NAMES.has(trimmed.toLowerCase())) {
        console.warn(`[cameraPresets] "${trimmed}" is a reserved built-in name`);
        return false;
      }
      const snapshot = captureCurrentSnapshot();
      if (!snapshot) return false;

      const next = { ...presets, [trimmed]: snapshot };
      const ok = await persist(next);
      if (ok) setPresets(next);
      return ok;
    },
    [presets, persist],
  );

  const applyPreset = useCallback(
    (name: string): boolean => {
      const snapshot = presets[name];
      if (!snapshot) return false;
      return applyCameraSnapshot(snapshot);
    },
    [presets],
  );

  const deletePreset = useCallback(
    async (name: string): Promise<void> => {
      const { [name]: _omit, ...rest } = presets;
      void _omit;
      const ok = await persist(rest);
      if (ok) setPresets(rest);
    },
    [presets, persist],
  );

  return { presets, isLoaded, savePreset, applyPreset, deletePreset };
}
