/**
 * useAnimation Hook
 * Custom hook for animation loading and playback management
 */

import { useCallback } from 'react';
import * as THREE from 'three';
import { loaderManager } from '../core/three/loaders/LoaderManager';
import { useAnimationStore } from '../store/animationStore';

/**
 * Generate a stable per-clip id. Prefers the clip's own name; falls back to
 * a counter-suffixed default for clips that don't carry a name.
 */
let clipIdCounter = 0;
function makeClipId(clip: THREE.AnimationClip): string {
  const base = clip.name && clip.name.trim().length > 0 ? clip.name.trim() : `clip-${++clipIdCounter}`;
  return `${base}::${Date.now()}`;
}

/**
 * useAnimation Hook
 *
 * Drives the AnimationManager (via animationStore) so the loaded clip
 * actually plays through Three.js's AnimationMixer instead of just flipping
 * state flags. If the manager isn't initialised yet (no VRM model loaded
 * yet), falls back to setting state-only so the UI stays consistent until
 * the model arrives.
 */
export function useAnimation() {
  const {
    currentAnimation,
    currentClipId,
    playbackState,
    error,
    metadata,
    setAnimation,
    setCurrentClipId,
    setPlaybackState,
    setError,
    clearError,
    setMetadata,
  } = useAnimationStore();

  /**
   * Register a clip with the AnimationManager and play it.
   * Returns the assigned clip id, or null if no manager is available.
   */
  const registerAndPlay = useCallback((clip: THREE.AnimationClip, fadeIn = 0.2): string | null => {
    const mgr = useAnimationStore.getState().animationManager;
    if (!mgr || !mgr.isInitialized()) return null;
    const id = makeClipId(clip);
    mgr.addClip(id, clip);
    mgr.play(id, fadeIn);
    setCurrentClipId(id);
    return id;
  }, [setCurrentClipId]);

  /**
   * Load animation from URL
   */
  const loadFromURL = useCallback(async (url: string) => {
    clearError();
    setMetadata(null);

    const result = await loaderManager.loadFromURL(url);

    if (result.success && result.data?.animation && result.data.metadata) {
      setAnimation(result.data.animation);
      setMetadata({
        name: result.data.metadata.name,
        format: result.data.metadata.format,
        duration: result.data.animation.duration,
      });
      registerAndPlay(result.data.animation);
    } else {
      setError(result.error?.message || 'Failed to load animation');
    }
  }, [setAnimation, clearError, setMetadata, setError, registerAndPlay]);

  /**
   * Load animation from File
   */
  const loadFromFile = useCallback(async (file: File) => {
    clearError();
    setMetadata(null);

    const result = await loaderManager.loadFromFile(file);

    if (result.success && result.data?.animation && result.data.metadata) {
      setAnimation(result.data.animation);
      setMetadata({
        name: result.data.metadata.name,
        format: result.data.metadata.format,
        duration: result.data.animation.duration,
      });
      registerAndPlay(result.data.animation);
    } else {
      setError(result.error?.message || 'Failed to load animation');
    }
  }, [setAnimation, clearError, setMetadata, setError, registerAndPlay]);

  /**
   * Load animation from ArrayBuffer
   */
  const loadFromArrayBuffer = useCallback(async (arrayBuffer: ArrayBuffer, filename: string) => {
    clearError();
    setMetadata(null);

    const result = await loaderManager.loadFromArrayBuffer(arrayBuffer, filename);

    if (result.success && result.data?.animation && result.data.metadata) {
      setAnimation(result.data.animation);
      setMetadata({
        name: result.data.metadata.name,
        format: result.data.metadata.format,
        duration: result.data.animation.duration,
      });
      registerAndPlay(result.data.animation);
    } else {
      setError(result.error?.message || 'Failed to load animation');
    }
  }, [setAnimation, clearError, setMetadata, setError, registerAndPlay]);

  /**
   * Play animation. If the AnimationManager is initialised, delegates to
   * `manager.play(currentClipId)` so the Three.js mixer actually runs.
   * Otherwise (no model loaded) just flips the state flag.
   */
  const play = useCallback((fadeIn = 0.2) => {
    if (!currentAnimation) return;
    const mgr = useAnimationStore.getState().animationManager;
    if (mgr && mgr.isInitialized() && currentClipId) {
      mgr.play(currentClipId, fadeIn);
    } else if (mgr && mgr.isInitialized() && currentAnimation) {
      // Manager came online after the clip was loaded (model loaded after
      // animation). Register the clip retroactively and play it.
      const id = makeClipId(currentAnimation);
      mgr.addClip(id, currentAnimation);
      mgr.play(id, fadeIn);
      setCurrentClipId(id);
    }
    setPlaybackState({ ...playbackState, isPlaying: true, isPaused: false });
  }, [currentAnimation, currentClipId, playbackState, setPlaybackState, setCurrentClipId]);

  /**
   * Pause animation
   */
  const pause = useCallback(() => {
    if (!currentAnimation) return;
    useAnimationStore.getState().animationManager?.pause();
    setPlaybackState({ ...playbackState, isPlaying: false, isPaused: true });
  }, [currentAnimation, playbackState, setPlaybackState]);

  /**
   * Stop animation
   */
  const stop = useCallback(() => {
    if (!currentAnimation) return;
    useAnimationStore.getState().animationManager?.stop(0.2);
    setPlaybackState({
      ...playbackState,
      isPlaying: false,
      isPaused: false,
      currentTime: 0,
    });
  }, [currentAnimation, playbackState, setPlaybackState]);

  /**
   * Set animation time
   */
  const setTime = useCallback((time: number) => {
    if (!currentAnimation) return;
    useAnimationStore.getState().animationManager?.seek(time);
    setPlaybackState({ ...playbackState, currentTime: time });
  }, [currentAnimation, playbackState, setPlaybackState]);

  /**
   * Set animation speed
   */
  const setSpeed = useCallback((speed: number) => {
    if (!currentAnimation) return;
    const clamped = Math.max(0.1, Math.min(speed, 5));
    useAnimationStore.getState().animationManager?.setSpeed(clamped);
    setPlaybackState({ ...playbackState, speed: clamped });
  }, [currentAnimation, playbackState, setPlaybackState]);

  /**
   * Set animation loop
   */
  const setLoop = useCallback((loop: boolean) => {
    if (!currentAnimation) return;
    useAnimationStore.getState().animationManager?.setLoop(loop);
    setPlaybackState({ ...playbackState, isLooping: loop });
  }, [currentAnimation, playbackState, setPlaybackState]);

  /**
   * Set the weight (0..1) of the currently-playing clip. Drives Three.js's
   * mixer weight via `manager.setWeight(currentClipId, weight)`; on a
   * pre-model load the weight is held in the playbackState shim so the
   * UI value persists.
   */
  const setWeight = useCallback((weight: number) => {
    const clamped = Math.max(0, Math.min(1, weight));
    const mgr = useAnimationStore.getState().animationManager;
    if (mgr && mgr.isInitialized() && currentClipId) {
      mgr.setWeight(currentClipId, clamped);
    }
    setPlaybackState({ ...playbackState, weight: clamped });
  }, [currentClipId, playbackState, setPlaybackState]);

  /**
   * Get animation info
   */
  const getAnimationInfo = useCallback(() => {
    if (!currentAnimation) {
      return {
        name: 'No animation loaded',
        duration: 0,
        format: 'none',
      };
    }

    return {
      name: currentAnimation.name,
      duration: currentAnimation.duration,
      format: 'three',
    };
  }, [currentAnimation]);

  return {
    currentAnimation,
    currentClipId,
    playbackState,
    error,
    metadata,
    loadFromURL,
    loadFromFile,
    loadFromArrayBuffer,
    play,
    pause,
    stop,
    setTime,
    setSpeed,
    setLoop,
    setWeight,
    getAnimationInfo,
  };
}
