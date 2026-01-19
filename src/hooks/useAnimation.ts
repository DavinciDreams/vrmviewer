/**
 * useAnimation Hook
 * Custom hook for animation loading and playback management
 */

import { useCallback } from 'react';
import { loaderManager } from '../core/three/loaders/LoaderManager';
import { useAnimationStore } from '../store/animationStore';

/**
 * useAnimation Hook
 */
export function useAnimation() {
  const {
    currentAnimation,
    playbackState,
    error,
    metadata,
    setAnimation,
    setPlaybackState,
    setError,
    clearError,
    setMetadata,
  } = useAnimationStore();

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
    } else {
      setError(result.error?.message || 'Failed to load animation');
    }
  }, [loaderManager, setAnimation, clearError, setMetadata, setError]);

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
    } else {
      setError(result.error?.message || 'Failed to load animation');
    }
  }, [loaderManager, setAnimation, clearError, setMetadata, setError]);

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
    } else {
      setError(result.error?.message || 'Failed to load animation');
    }
  }, [loaderManager, setAnimation, clearError, setMetadata, setError]);

  /**
   * Play animation
   */
  const play = useCallback(() => {
    if (!currentAnimation) {
      return;
    }

    setPlaybackState({ ...playbackState, isPlaying: true, isPaused: false });
  }, [currentAnimation, playbackState, setPlaybackState]);

  /**
   * Pause animation
   */
  const pause = useCallback(() => {
    if (!currentAnimation) {
      return;
    }

    setPlaybackState({ ...playbackState, isPlaying: false, isPaused: true });
  }, [currentAnimation, playbackState, setPlaybackState]);

  /**
   * Stop animation
   */
  const stop = useCallback(() => {
    if (!currentAnimation) {
      return;
    }

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
    if (!currentAnimation) {
      return;
    }

    setPlaybackState({ ...playbackState, currentTime: time });
  }, [currentAnimation, playbackState, setPlaybackState]);

  /**
   * Set animation speed
   */
  const setSpeed = useCallback((speed: number) => {
    if (!currentAnimation) {
      return;
    }

    setPlaybackState({ ...playbackState, speed: Math.max(0.1, Math.min(speed, 5)) });
  }, [currentAnimation, playbackState, setPlaybackState]);

  /**
   * Set animation loop
   */
  const setLoop = useCallback((loop: boolean) => {
    if (!currentAnimation) {
      return;
    }

    setPlaybackState({ ...playbackState, isLooping: loop });
  }, [currentAnimation, playbackState, setPlaybackState]);

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
    getAnimationInfo,
  };
}
