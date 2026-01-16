/**
 * usePlayback Hook
 * Custom hook for animation playback control
 */

import { useCallback, useEffect } from 'react';
import { usePlaybackStore } from '../store/playbackStore';

/**
 * Playback hook return type
 */
export interface PlaybackControls {
  // State
  isPlaying: boolean;
  isPaused: boolean;
  isStopped: boolean;
  currentTime: number;
  duration: number;
  progress: number;
  speed: number;
  loop: boolean;
  currentAnimationId: string | null;
  currentAnimationName: string | null;

  // Actions
  play: () => void;
  pause: () => void;
  stop: () => void;
  seek: (time: number) => void;
  seekToProgress: (progress: number) => void;
  setSpeed: (speed: number) => void;
  toggleLoop: () => void;
  setLoop: (loop: boolean) => void;
  setCurrentAnimation: (id: string, name: string) => void;
  clearCurrentAnimation: () => void;
}

/**
 * usePlayback hook
 */
export function usePlayback(): PlaybackControls {
  // Get state and actions from store
  const {
    isPlaying,
    isPaused,
    isStopped,
    currentTime,
    duration,
    speed,
    loop,
    currentAnimationId,
    currentAnimationName,
    play,
    pause,
    stop,
    seek,
    setSpeed,
    setLoop,
    setCurrentAnimation,
    clearCurrentAnimation,
  } = usePlaybackStore();

  // Calculate progress
  const progress = duration > 0 ? currentTime / duration : 0;

  // Seek to progress
  const seekToProgress = useCallback(
    (progressValue: number) => {
      const clampedProgress = Math.max(0, Math.min(1, progressValue));
      seek(clampedProgress * duration);
    },
    [seek, duration]
  );

  // Toggle loop
  const toggleLoop = useCallback(() => {
    setLoop(!loop);
  }, [loop, setLoop]);

  // Update current time (for external updates)
  useEffect(() => {
    if (isPlaying && !isPaused) {
      // This would typically be called from the animation loop
      // For now, it's a placeholder
    }
  }, [isPlaying, isPaused]);

  return {
    // State
    isPlaying,
    isPaused,
    isStopped,
    currentTime,
    duration,
    progress,
    speed,
    loop,
    currentAnimationId,
    currentAnimationName,

    // Actions
    play,
    pause,
    stop,
    seek,
    seekToProgress,
    setSpeed,
    toggleLoop,
    setLoop,
    setCurrentAnimation,
    clearCurrentAnimation,
  };
}

/**
 * usePlaybackState hook
 * Returns only playback state (no actions)
 */
export function usePlaybackState() {
  return usePlaybackStore((state) => ({
    isPlaying: state.isPlaying,
    isPaused: state.isPaused,
    isStopped: state.isStopped,
    currentTime: state.currentTime,
    duration: state.duration,
    progress: state.duration > 0 ? state.currentTime / state.duration : 0,
    speed: state.speed,
    loop: state.loop,
    currentAnimationId: state.currentAnimationId,
    currentAnimationName: state.currentAnimationName,
  }));
}

/**
 * usePlaybackActions hook
 * Returns only playback actions (no state)
 */
export function usePlaybackActions() {
  return usePlaybackStore((state) => ({
    play: state.play,
    pause: state.pause,
    stop: state.stop,
    seek: state.seek,
    setSpeed: state.setSpeed,
    setLoop: state.setLoop,
    setCurrentAnimation: state.setCurrentAnimation,
    clearCurrentAnimation: state.clearCurrentAnimation,
    updateCurrentTime: state.updateCurrentTime,
    setDuration: state.setDuration,
  }));
}
