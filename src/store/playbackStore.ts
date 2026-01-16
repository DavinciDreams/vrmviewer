/**
 * Playback Store
 * Zustand store for animation playback state
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

/**
 * Playback state
 */
export interface PlaybackState {
  // Playback status
  isPlaying: boolean;
  isPaused: boolean;
  isStopped: boolean;

  // Time
  currentTime: number;
  duration: number;

  // Playback controls
  speed: number;
  loop: boolean;

  // Current animation
  currentAnimationId: string | null;
  currentAnimationName: string | null;

  // Actions
  play: () => void;
  pause: () => void;
  stop: () => void;
  seek: (time: number) => void;
  setSpeed: (speed: number) => void;
  setLoop: (loop: boolean) => void;
  setCurrentAnimation: (id: string, name: string) => void;
  clearCurrentAnimation: () => void;
  updateCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  reset: () => void;
}

/**
 * Create playback store
 */
export const usePlaybackStore = create<PlaybackState>()(
  devtools(
    persist(
      (set) => ({
        // Initial state
        isPlaying: false,
        isPaused: false,
        isStopped: true,
        currentTime: 0,
        duration: 0,
        speed: 1,
        loop: true,
        currentAnimationId: null,
        currentAnimationName: null,

        // Actions
        play: () =>
          set({
            isPlaying: true,
            isPaused: false,
            isStopped: false,
          }),

        pause: () =>
          set({
            isPlaying: false,
            isPaused: true,
            isStopped: false,
          }),

        stop: () =>
          set({
            isPlaying: false,
            isPaused: false,
            isStopped: true,
            currentTime: 0,
          }),

        seek: (time: number) =>
          set((state) => ({
            currentTime: Math.max(0, Math.min(time, state.duration)),
          })),

        setSpeed: (speed: number) =>
          set({
            speed: Math.max(0.1, Math.min(speed, 5)),
          }),

        setLoop: (loop: boolean) =>
          set({
            loop,
          }),

        setCurrentAnimation: (id: string, name: string) =>
          set({
            currentAnimationId: id,
            currentAnimationName: name,
            currentTime: 0,
            isPlaying: false,
            isPaused: false,
            isStopped: true,
          }),

        clearCurrentAnimation: () =>
          set({
            currentAnimationId: null,
            currentAnimationName: null,
            currentTime: 0,
            isPlaying: false,
            isPaused: false,
            isStopped: true,
          }),

        updateCurrentTime: (time: number) =>
          set((state) => ({
            currentTime: Math.max(0, Math.min(time, state.duration)),
          })),

        setDuration: (duration: number) =>
          set({
            duration: Math.max(0, duration),
          }),

        reset: () =>
          set({
            isPlaying: false,
            isPaused: false,
            isStopped: true,
            currentTime: 0,
            duration: 0,
            speed: 1,
            loop: true,
            currentAnimationId: null,
            currentAnimationName: null,
          }),
      }),
      {
        name: 'playback-storage',
        // Only persist certain fields
        partialize: (state) => ({
          speed: state.speed,
          loop: state.loop,
        }),
      }
    )
  )
);

/**
 * Selectors
 */
export const selectPlaybackState = (state: PlaybackState) => ({
  isPlaying: state.isPlaying,
  isPaused: state.isPaused,
  isStopped: state.isStopped,
});

export const selectPlaybackTime = (state: PlaybackState) => ({
  currentTime: state.currentTime,
  duration: state.duration,
  progress: state.duration > 0 ? state.currentTime / state.duration : 0,
});

export const selectPlaybackControls = (state: PlaybackState) => ({
  speed: state.speed,
  loop: state.loop,
});

export const selectCurrentAnimation = (state: PlaybackState) => ({
  id: state.currentAnimationId,
  name: state.currentAnimationName,
});
