/**
 * useAnimation Hook
 * Custom hook for animation loading and playback management
 */

import { useCallback } from 'react';
import { loaderManager } from '../core/three/loaders/LoaderManager';
import { useAnimationStore } from '../store/animationStore';
import { validateAnimationFile } from '../utils/fileUtils';

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
    clearAnimation();
    clearError();
    setMetadata(null);

    const result = await loaderManager.loadFromURL(url, {
      progressCallback: (_progress) => {
        // Progress updates can be handled here if needed
      },
    });

    if (result.success && result.data?.animation && result.data?.metadata) {
      setAnimation(result.data.animation);
      setMetadata({
        name: result.data.metadata.name,
        format: result.data.metadata.format,
        duration: result.data.animation.duration,
      });
    } else {
      setError(result.error?.message || 'Failed to load animation');
    }
  }, [loaderManager, clearAnimation, clearError, setMetadata, setAnimation, setError]);

  /**
   * Load animation from File
   */
  const loadFromFile = useCallback(async (file: File) => {
    clearAnimation();
    clearError();
    setMetadata(null);

    const validation = validateAnimationFile(file);
    
    if (!validation.valid) {
      setError(validation.error || 'Invalid file');
      return;
    }

    const result = await loaderManager.loadFromFile(file, {
      progressCallback: (_progress) => {
        // Progress updates can be handled here if needed
      },
    });

    if (result.success && result.data?.animation && result.data?.metadata) {
      setAnimation(result.data.animation);
      setMetadata({
        name: result.data.metadata.name,
        format: result.data.metadata.format,
        duration: result.data.animation.duration,
      });
    } else {
      setError(result.error?.message || 'Failed to load animation');
    }
  }, [loaderManager, clearAnimation, clearError, setMetadata, setAnimation, setError]);

  /**
   * Load animation from ArrayBuffer
   */
  const loadFromArrayBuffer = useCallback(async (arrayBuffer: ArrayBuffer, filename: string) => {
    clearAnimation();
    clearError();
    setMetadata(null);

    const result = await loaderManager.loadFromArrayBuffer(arrayBuffer, filename, {
      progressCallback: (_progress) => {
        // Progress updates can be handled here if needed
      },
    });

    if (result.success && result.data?.animation && result.data?.metadata) {
      setAnimation(result.data.animation);
      setMetadata({
        name: result.data.metadata.name,
        format: result.data.metadata.format,
        duration: result.data.animation.duration,
      });
    } else {
      setError(result.error?.message || 'Failed to load animation');
    }
  }, [loaderManager, clearAnimation, clearError, setMetadata, setAnimation, setError]);

  /**
   * Play animation
   */
  const play = useCallback(() => {
    if (!currentAnimation) {
      return;
    }

    setPlaybackState({
      ...playbackState,
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
      ...playbackState,
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

    setPlaybackState({
      ...playbackState,
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
      ...playbackState,
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
      ...playbackState,
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
