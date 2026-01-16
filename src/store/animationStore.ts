/**
 * Animation Store
 * Zustand store for animation state management
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import * as THREE from 'three';
import { AnimationState } from '../types/animation.types';
import { AnimationManager } from '../core/three/animation/AnimationManager';
import { BlendShapeManager } from '../core/three/animation/BlendShapeManager';
import { IdleAnimationController } from '../core/three/animation/IdleAnimationController';
import { VRM } from '@pixiv/three-vrm';

/**
 * Animation Store State
 */
interface AnimationStoreState {
  currentAnimation: THREE.AnimationClip | null;
  animations: Map<string, THREE.AnimationClip>;
  playbackState: AnimationState;
  error: string | null;
  metadata: {
    name: string;
    format: string;
    duration: number;
  } | null;

  // Animation managers
  animationManager: AnimationManager | null;
  blendShapeManager: BlendShapeManager | null;
  idleAnimationController: IdleAnimationController | null;
}

/**
 * Animation Store Actions
 */
interface AnimationStoreActions {
  setAnimation: (animation: THREE.AnimationClip) => void;
  setAnimations: (animations: Map<string, THREE.AnimationClip>) => void;
  setPlaybackState: (state: AnimationState) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  setMetadata: (metadata: AnimationStoreState['metadata']) => void;
  clearAnimation: () => void;

  // Manager actions
  setAnimationManager: (manager: AnimationManager | null) => void;
  setBlendShapeManager: (manager: BlendShapeManager | null) => void;
  setIdleAnimationController: (controller: IdleAnimationController | null) => void;
  initializeManagers: (vrm: VRM) => void;
  disposeManagers: () => void;
}

/**
 * Create animation store
 */
export const useAnimationStore = create<AnimationStoreState & AnimationStoreActions>()(
  devtools(
    (set) => ({
      // Initial state
      currentAnimation: null,
      animations: new Map(),
      playbackState: {
        isPlaying: false,
        isPaused: false,
        isLooping: false,
        currentTime: 0,
        duration: 0,
        speed: 1,
        weight: 1,
        fadeIn: 0,
        fadeOut: 0,
        blendMode: 0 as THREE.AnimationBlendMode,
      },
      error: null,
      metadata: null,
      animationManager: null,
      blendShapeManager: null,
      idleAnimationController: null,

      // Actions
      setAnimation: (animation) =>
        set({
          currentAnimation: animation,
        }),

      setAnimations: (animations) =>
        set({
          animations: new Map(animations),
        }),

      setPlaybackState: (state) =>
        set({
          playbackState: state,
        }),

      setError: (error) =>
        set({
          error,
        }),

      clearError: () =>
        set({
          error: null,
        }),

      setMetadata: (metadata) =>
        set({
          metadata,
        }),

      clearAnimation: () =>
        set({
          currentAnimation: null,
        }),

      // Manager actions
      setAnimationManager: (manager) =>
        set({
          animationManager: manager,
        }),

      setBlendShapeManager: (manager) =>
        set({
          blendShapeManager: manager,
        }),

      setIdleAnimationController: (controller) =>
        set({
          idleAnimationController: controller,
        }),

      initializeManagers: (vrm) =>
        set((state) => {
          // Initialize managers if not already initialized
          const animationManager = state.animationManager || new AnimationManager();
          const blendShapeManager = state.blendShapeManager || new BlendShapeManager();
          const idleAnimationController = state.idleAnimationController || new IdleAnimationController();

          // Initialize with VRM
          animationManager.initialize(vrm);
          blendShapeManager.initialize(vrm);
          idleAnimationController.initialize(vrm, blendShapeManager);

          return {
            animationManager,
            blendShapeManager,
            idleAnimationController,
          };
        }),

      disposeManagers: () =>
        set((state) => {
          if (state.animationManager) {
            state.animationManager.dispose();
          }
          if (state.blendShapeManager) {
            state.blendShapeManager.dispose();
          }
          if (state.idleAnimationController) {
            state.idleAnimationController.dispose();
          }

          return {
            animationManager: null,
            blendShapeManager: null,
            idleAnimationController: null,
          };
        }),
    }),
    {
      name: 'animation-storage',
      // Don't persist managers (they're recreated on load)
      partialize: (state) => ({
        currentAnimation: state.currentAnimation,
        playbackState: state.playbackState,
        metadata: state.metadata,
      }),
    }
  )
);

/**
 * Selectors
 */
export const selectAnimationState = (state: AnimationStoreState) => ({
  currentAnimation: state.currentAnimation,
  animations: state.animations,
  playbackState: state.playbackState,
});

export const selectAnimationManagers = (state: AnimationStoreState) => ({
  animationManager: state.animationManager,
  blendShapeManager: state.blendShapeManager,
  idleAnimationController: state.idleAnimationController,
});

export const selectAnimationError = (state: AnimationStoreState) => ({
  error: state.error,
});
