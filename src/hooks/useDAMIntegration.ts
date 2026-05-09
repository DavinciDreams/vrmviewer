/**
 * useDAMIntegration Hook
 * Custom hook for DAM (Digital Asset Management) integration
 * Supports URL query parameter-based model loading and backend-driven loading
 */

import { useEffect, useCallback, useState, useRef } from 'react';
import * as THREE from 'three';
import { useVRM } from './useVRM';
import { usePlayback } from './usePlayback';
import { useAnimation } from './useAnimation';
import { cameraManager } from '../core/three/scene/CameraManager';
import { lightingManager } from '../core/three/scene/LightingManager';
import { usePlaybackStore } from '../store/playbackStore';

/**
 * DAM configuration from URL query parameters
 */
export interface DAMConfig {
  model?: string;
  animation?: string;
  autoplay?: boolean;
  loop?: boolean;
  camera?: string;
  speed?: number;
  background?: string;
  lighting?: string;
  wireframe?: boolean;
  visible?: boolean;
}

/**
 * DAM loading state
 */
export interface DAMLoadingState {
  isLoading: boolean;
  error: string | null;
  modelLoaded: boolean;
  animationLoaded: boolean;
}

/**
 * DAM integration result
 */
export interface DAMIntegrationResult {
  config: DAMConfig;
  loadingState: DAMLoadingState;
  loadModelFromURL: (url: string) => Promise<void>;
  loadAnimationFromURL: (url: string) => Promise<void>;
  loadFromConfig: (config: DAMConfig) => Promise<void>;
  clearDAMState: () => void;
}

/**
 * Parse URL query parameters
 */
function parseURLParams(): DAMConfig {
  if (typeof window === 'undefined') {
    return {};
  }

  const params = new URLSearchParams(window.location.search);
  
  return {
    model: params.get('model') || undefined,
    animation: params.get('animation') || undefined,
    autoplay: params.get('autoplay') === 'true',
    loop: params.get('loop') === 'true',
    camera: params.get('camera') || undefined,
    speed: params.get('speed') ? parseFloat(params.get('speed')!) : undefined,
    background: params.get('background') || undefined,
    lighting: params.get('lighting') || undefined,
    wireframe: params.get('wireframe') === 'true',
    visible: params.get('visible') === 'false' ? false : true,
  };
}

/**
 * Validate URL
 */
function isValidURL(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * useDAMIntegration Hook
 */
export function useDAMIntegration(): DAMIntegrationResult {
  const { loadFromURL: loadVRMFromURL, clearCurrentModel } = useVRM();
  const { play, pause, setSpeed, toggleLoop } = usePlayback();
  const { loadFromFile: loadAnimationFromFile, play: playAnimation, pause: pauseAnimation } = useAnimation();
  
  const [config, setConfig] = useState<DAMConfig>({});
  const [loadingState, setLoadingState] = useState<DAMLoadingState>({
    isLoading: false,
    error: null,
    modelLoaded: false,
    animationLoaded: false,
  });
  
  const initializedRef = useRef(false);

  /**
   * Load model from URL
   */
  const loadModelFromURL = useCallback(async (url: string) => {
    // Validate URL
    if (!isValidURL(url)) {
      setLoadingState(prev => ({
        ...prev,
        error: `Invalid model URL: ${url}`,
      }));
      return;
    }

    setLoadingState(prev => ({
      ...prev,
      isLoading: true,
      error: null,
    }));

    try {
      await loadVRMFromURL(url);
      
      setLoadingState(prev => ({
        ...prev,
        isLoading: false,
        modelLoaded: true,
      }));
    } catch (error) {
      setLoadingState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load model from URL',
      }));
    }
  }, [loadVRMFromURL]);

  /**
   * Load animation from URL
   */
  const loadAnimationFromURL = useCallback(async (url: string) => {
    // Validate URL
    if (!isValidURL(url)) {
      setLoadingState(prev => ({
        ...prev,
        error: `Invalid animation URL: ${url}`,
      }));
      return;
    }

    setLoadingState(prev => ({
      ...prev,
      isLoading: true,
      error: null,
    }));

    try {
      // Fetch the animation file
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch animation: ${response.statusText}`);
      }
      
      const blob = await response.blob();
      const extension = url.split('.').pop()?.toLowerCase() || 'vrma';
      const filename = `animation.${extension}`;
      const file = new File([blob], filename, { type: 'application/octet-stream' });
      
      await loadAnimationFromFile(file);
      
      setLoadingState(prev => ({
        ...prev,
        isLoading: false,
        animationLoaded: true,
      }));
    } catch (error) {
      setLoadingState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load animation from URL',
      }));
    }
  }, [loadAnimationFromFile]);

  /**
   * Apply camera configuration
   */
  const applyCameraConfig = useCallback((cameraConfig?: string) => {
    if (!cameraConfig || !cameraManager) {
      return;
    }

    try {
      // Parse camera configuration
      // Format: "x,y,z" for position or "preset:name" for presets
      if (cameraConfig.startsWith('preset:')) {
        const preset = cameraConfig.replace('preset:', '');
        switch (preset.toLowerCase()) {
          case 'front':
            cameraManager.setCameraPosition(new THREE.Vector3(0, 1.5, 3));
            break;
          case 'side':
            cameraManager.setCameraPosition(new THREE.Vector3(3, 1.5, 0));
            break;
          case 'top':
            cameraManager.setCameraPosition(new THREE.Vector3(0, 4, 2));
            break;
          case 'default':
          default:
            cameraManager.resetCamera();
            break;
        }
      } else {
        // Parse position coordinates
        const coords = cameraConfig.split(',').map(Number);
        if (coords.length === 3 && !coords.some(isNaN)) {
          cameraManager.setCameraPosition(new THREE.Vector3(coords[0], coords[1], coords[2]));
        }
      }
    } catch (error) {
      console.warn('Failed to apply camera configuration:', error);
    }
  }, []);

  /**
   * Apply background colour to the renderer's clear colour. Accepts either a
   * CSS hex string ("#1a1a2e") or a comma-separated 0-255 RGB triple
   * ("26,26,46"). Silently ignores values that don't parse.
   */
  const applyBackgroundConfig = useCallback((bg?: string) => {
    if (!bg || !cameraManager) return;
    try {
      const renderer = cameraManager.getRenderer();
      let color: THREE.Color | null = null;
      if (bg.startsWith('#')) {
        color = new THREE.Color(bg);
      } else if (bg.includes(',')) {
        const [r, g, b] = bg.split(',').map(Number);
        if ([r, g, b].every((v) => Number.isFinite(v) && v >= 0 && v <= 255)) {
          color = new THREE.Color(r / 255, g / 255, b / 255);
        }
      } else {
        // Named CSS colour or 6-char hex without the leading #.
        color = new THREE.Color(bg);
      }
      if (color) {
        renderer.setClearColor(color, 1);
      }
    } catch (error) {
      console.warn('Failed to apply background configuration:', error);
    }
  }, []);

  /**
   * Apply a lighting preset to the LightingManager. Presets are matched
   * loosely so callers can pass "studio", "soft-studio", etc. Falls back to
   * the manager's existing values if the preset name is unrecognised.
   */
  const applyLightingConfig = useCallback((preset?: string) => {
    if (!preset || !lightingManager) return;
    const key = preset.toLowerCase();
    try {
      // (ambient, directional) intensities per preset.
      const presets: Record<string, [number, number]> = {
        soft: [0.7, 0.6],
        studio: [0.5, 1.5],
        dim: [0.2, 0.4],
        bright: [1.0, 1.5],
        flat: [1.2, 0.2],
        default: [0.6, 0.8],
      };
      const match = presets[key];
      if (!match) return;
      const [ambient, directional] = match;
      lightingManager.setAmbientIntensity(ambient);
      lightingManager.setDirectionalIntensity(directional);
    } catch (error) {
      console.warn('Failed to apply lighting configuration:', error);
    }
  }, []);

  /**
   * Apply playback configuration
   */
  const applyPlaybackConfig = useCallback((damConfig: DAMConfig) => {
    // Apply speed
    if (damConfig.speed !== undefined) {
      setSpeed(damConfig.speed);
    }

    // Apply loop
    if (damConfig.loop !== undefined) {
      // Toggle to match desired state
      const currentState = usePlaybackStore.getState().loop;
      if (currentState !== damConfig.loop) {
        toggleLoop();
      }
    }

    // Apply autoplay
    if (damConfig.autoplay) {
      play();
      playAnimation();
    } else {
      pause();
      pauseAnimation();
    }
  }, [setSpeed, toggleLoop, play, pause, playAnimation, pauseAnimation]);

  /**
   * Load from DAM configuration
   */
  const loadFromConfig = useCallback(async (damConfig: DAMConfig) => {
    setLoadingState(prev => ({
      ...prev,
      isLoading: true,
      error: null,
    }));

    try {
      // Clear current state
      clearCurrentModel();
      
      // Load model if specified
      if (damConfig.model) {
        await loadModelFromURL(damConfig.model);
      }

      // Load animation if specified
      if (damConfig.animation) {
        await loadAnimationFromURL(damConfig.animation);
      }

      // Apply scene configuration (background colour, lighting preset).
      applyBackgroundConfig(damConfig.background);
      applyLightingConfig(damConfig.lighting);

      // Apply camera configuration
      applyCameraConfig(damConfig.camera);

      // Apply playback configuration
      applyPlaybackConfig(damConfig);

      setLoadingState(prev => ({
        ...prev,
        isLoading: false,
      }));
    } catch (error) {
      setLoadingState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load from DAM configuration',
      }));
    }
  }, [loadModelFromURL, loadAnimationFromURL, applyCameraConfig, applyBackgroundConfig, applyLightingConfig, applyPlaybackConfig, clearCurrentModel]);

  /**
   * Clear DAM state
   */
  const clearDAMState = useCallback(() => {
    setLoadingState({
      isLoading: false,
      error: null,
      modelLoaded: false,
      animationLoaded: false,
    });
    setConfig({});
  }, []);

  /**
   * Initialize DAM integration on mount
   */
  useEffect(() => {
    if (initializedRef.current) {
      return;
    }

    initializedRef.current = true;

    // Parse URL parameters
    const urlConfig = parseURLParams();
    setConfig(urlConfig);

    // Load model from URL if specified
    if (urlConfig.model) {
      loadFromConfig(urlConfig);
    }
  }, [loadFromConfig]);

  return {
    config,
    loadingState,
    loadModelFromURL,
    loadAnimationFromURL,
    loadFromConfig,
    clearDAMState,
  };
}

