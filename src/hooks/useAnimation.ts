/**
 * useAnimation Hook
 * Custom hook for animation loading and playback management
 */

import { useCallback, useEffect } from 'react';
import { loaderManager } from '../core/three/loaders/LoaderManager';
import { useAnimationStore } from '../store/animationStore';
import { getFileInfo, validateAnimationFile } from '../utils/fileUtils';

/**
 * useAnimation Hook
 */
export function useAnimation() {
  const {
    currentAnimation,
    animations,
    playbackState,
    error,
    metadata,
    setAnimation,
    setAnimations,
    setPlaybackState,
    setError,
    clearError,
    setMetadata,
    clearAnimation,
  } = useAnimationStore();

  /**
   * Load animation from URL
   */
  const loadFromURL = useCallback(async (url: string) => {
    setAnimation(null);
    clearError();
    setMetadata(null);
    clearAnimation();

    const result = await loaderManager.loadFromURL(url, {
      progressCallback: (progress) => {
        // Progress updates can be handled here if needed
      },
    });

    if (result.success && result.data?.animation) {
      setAnimation(result.data.animation);
      setMetadata({
        name: result.data.metadata.name,
        format: result.data.metadata.format,
        duration: result.data.animation.duration,
      });
    } else {
      setError(result.error?.message || 'Failed to load animation');
    }
  }, [loaderManager, setAnimation, clearError, setMetadata, clearAnimation, setError]);

  /**
   * Load animation from File
   */
  const loadFromFile = useCallback(async (file: File) => {
    setAnimation(null);
    clearError();
    setMetadata(null);
    clearAnimation();

    const validation = validateAnimationFile(file);
    
    if (!validation.valid) {
      setError(validation.error || 'Invalid file');
      return;
    }

    const result = await loaderManager.loadFromFile(file, {
      progressCallback: (progress) => {
        // Progress updates can be handled here if needed
      },
    });

    if (result.success && result.data?.animation) {
      setAnimation(result.data.animation);
      setMetadata({
        name: result.data.metadata.name,
        format: result.data.metadata.format,
        duration: result.data.animation.duration,
      });
    } else {
      setError(result.error?.message || 'Failed to load animation');
    }
  }, [loaderManager, setAnimation, clearError, setMetadata, clearAnimation, setError]);

  /**
   * Load animation from ArrayBuffer
   */
  const loadFromArrayBuffer = useCallback(async (arrayBuffer: ArrayBuffer, filename: string) => {
    setAnimation(null);
    clearError();
    setMetadata(null);
    clearAnimation();

    const result = await loaderManager.loadFromArrayBuffer(arrayBuffer, filename, {
      progressCallback: (progress) => {
        // Progress updates can be handled here if needed
      },
    });

    if (result.success && result.data?.animation) {
      setAnimation(result.data.animation);
      setMetadata({
        name: result.data.metadata.name,
        format: result.data.metadata.format,
        duration: result.data.animation.duration,
      });
    } else {
      setError(result.error?.message || 'Failed to load animation');
    }
  }, [loaderManager, setAnimation, clearError, setMetadata, clearAnimation, setError]);

  /**
   * Play animation
   */
  const play = useCallback(() => {
    if (!currentAnimation) {
      return;
    }

    setPlaybackState({
      isPlaying: true,
      isPaused: false,
    });
  }, [currentAnimation, playbackState, setPlaybackState]);

  /**
   * Pause animation
   */
  const pause = useCallback(() => {
    if (!currentAnimation) {
      return;
    }

    setPlaybackState({
      isPlaying: false,
      isPaused: true,
    });
  }, [currentAnimation, playbackState, setPlaybackState]);

  /**
   * Stop animation
   */
  const stop = useCallback(() => {
    if (!currentAnimation) {
      return;
    }

    setPlaybackState({
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

    setPlaybackState({
      currentTime: time,
    });
  }, [currentAnimation, playbackState, setPlaybackState]);

  /**
   * Set animation speed
   */
  const setSpeed = useCallback((speed: number) => {
    if (!currentAnimation) {
      return;
    }

    setPlaybackState({
      speed: Math.max(0.1, Math.min(speed, 5)),
    });
  }, [currentAnimation, playbackState, setPlaybackState]);

  /**
   * Set animation loop
   */
  const setLoop = useCallback((loop: boolean) => {
    if (!currentAnimation) {
      return;
    }

    setPlaybackState({
      isLooping: loop,
    });
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
    animations,
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
