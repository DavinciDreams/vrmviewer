/**
 * Animation Manager
 * Manages Three.js animation mixer, clips, and playback
 */

import * as THREE from 'three';
import { AnimationClip, AnimationMixer, AnimationAction, LoopOnce, LoopRepeat } from 'three';
import { VRM } from '@pixiv/three-vrm';

/**
 * Animation layer priority
 */
export enum AnimationLayer {
  Base = 0,
  Idle = 1,
  Facial = 2,
  Gesture = 3,
}

/**
 * Animation state
 */
export interface AnimationState {
  isPlaying: boolean;
  isPaused: boolean;
  currentTime: number;
  duration: number;
  speed: number;
  loop: boolean;
}

/**
 * Animation clip info
 */
export interface AnimationClipInfo {
  id: string;
  name: string;
  clip: AnimationClip;
  duration: number;
  layer: AnimationLayer;
  weight: number;
  fadeIn: number;
  fadeOut: number;
}

/**
 * Animation Manager class
 */
export class AnimationManager {
  private mixer: AnimationMixer | null = null;
  private actions: Map<string, AnimationAction> = new Map();
  private clips: Map<string, AnimationClipInfo> = new Map();
  private currentAnimation: string | null = null;
  private clock: THREE.Clock = new THREE.Clock();
  private state: AnimationState = {
    isPlaying: false,
    isPaused: false,
    currentTime: 0,
    duration: 0,
    speed: 1,
    loop: true,
  };

  /**
   * Initialize animation manager with a VRM model
   */
  public initialize(vrm: VRM): void {
    this.mixer = new AnimationMixer(vrm.scene);
    this.state.isPlaying = false;
    this.state.currentTime = 0;
  }

  /**
   * Update animation mixer
   */
  public update(deltaTime?: number): void {
    if (!this.mixer) return;

    const dt = deltaTime ?? this.clock.getDelta();
    this.mixer.update(dt);

    if (this.state.isPlaying && !this.state.isPaused) {
      this.state.currentTime += dt * this.state.speed;
      
      // Handle loop
      if (this.currentAnimation) {
        const clipInfo = this.clips.get(this.currentAnimation);
        if (clipInfo && this.state.loop) {
          if (this.state.currentTime >= clipInfo.duration) {
            this.state.currentTime = 0;
          }
        } else if (clipInfo && this.state.currentTime >= clipInfo.duration) {
          this.pause();
          this.state.currentTime = clipInfo.duration;
        }
      }
    }
  }

  /**
   * Add animation clip
   */
  public addClip(
    id: string,
    clip: AnimationClip,
    layer: AnimationLayer = AnimationLayer.Base,
    weight: number = 1,
    fadeIn: number = 0.2,
    fadeOut: number = 0.2
  ): void {
    if (!this.mixer) {
      throw new Error('AnimationManager not initialized');
    }

    const action = this.mixer.clipAction(clip);
    this.actions.set(id, action);

    const clipInfo: AnimationClipInfo = {
      id,
      name: clip.name,
      clip,
      duration: clip.duration,
      layer,
      weight,
      fadeIn,
      fadeOut,
    };

    this.clips.set(id, clipInfo);
  }

  /**
   * Play animation by ID
   */
  public play(id: string, fadeIn: number = 0.2): void {
    const action = this.actions.get(id);
    const clipInfo = this.clips.get(id);

    if (!action || !clipInfo) {
      throw new Error(`Animation ${id} not found`);
    }

    // Fade out current animation if exists
    if (this.currentAnimation && this.currentAnimation !== id) {
      const currentAction = this.actions.get(this.currentAnimation);
      const currentClipInfo = this.clips.get(this.currentAnimation);
      if (currentAction && currentClipInfo) {
        currentAction.fadeOut(currentClipInfo.fadeOut);
      }
    }

    // Set weight and play
    action.enabled = true;
    action.setEffectiveWeight(clipInfo.weight);
    action.fadeIn(fadeIn);
    action.play();

    this.currentAnimation = id;
    this.state.isPlaying = true;
    this.state.isPaused = false;
    this.state.duration = clipInfo.duration;
    this.state.currentTime = 0;
  }

  /**
   * Pause current animation
   */
  public pause(): void {
    if (!this.currentAnimation) return;

    const action = this.actions.get(this.currentAnimation);
    if (action) {
      action.paused = true;
    }

    this.state.isPaused = true;
  }

  /**
   * Resume paused animation
   */
  public resume(): void {
    if (!this.currentAnimation) return;

    const action = this.actions.get(this.currentAnimation);
    if (action) {
      action.paused = false;
    }

    this.state.isPaused = false;
  }

  /**
   * Stop current animation
   */
  public stop(fadeOut: number = 0.2): void {
    if (!this.currentAnimation) return;

    const action = this.actions.get(this.currentAnimation);
    const clipInfo = this.clips.get(this.currentAnimation);
    
    if (action && clipInfo) {
      action.fadeOut(fadeOut);
      setTimeout(() => {
        action.stop();
        action.enabled = false;
      }, fadeOut * 1000);
    }

    this.currentAnimation = null;
    this.state.isPlaying = false;
    this.state.isPaused = false;
    this.state.currentTime = 0;
  }

  /**
   * Seek to specific time
   */
  public seek(time: number): void {
    if (!this.currentAnimation) return;

    const action = this.actions.get(this.currentAnimation);
    const clipInfo = this.clips.get(this.currentAnimation);
    
    if (action && clipInfo) {
      const clampedTime = Math.max(0, Math.min(time, clipInfo.duration));
      action.time = clampedTime;
      this.state.currentTime = clampedTime;
    }
  }

  /**
   * Set playback speed
   */
  public setSpeed(speed: number): void {
    this.state.speed = speed;
    
    if (!this.currentAnimation) return;

    const action = this.actions.get(this.currentAnimation);
    if (action) {
      action.timeScale = speed;
    }
  }

  /**
   * Set loop mode
   */
  public setLoop(loop: boolean): void {
    this.state.loop = loop;

    if (!this.currentAnimation) return;

    const action = this.actions.get(this.currentAnimation);
    if (action) {
      action.setLoop(loop ? LoopRepeat : LoopOnce, 1);
    }
  }

  /**
   * Set animation weight
   */
  public setWeight(id: string, weight: number): void {
    const action = this.actions.get(id);
    if (action) {
      action.setEffectiveWeight(weight);
    }

    const clipInfo = this.clips.get(id);
    if (clipInfo) {
      clipInfo.weight = weight;
    }
  }

  /**
   * Blend between animations
   */
  public blend(fromId: string, toId: string, duration: number = 0.5): void {
    const fromAction = this.actions.get(fromId);
    const toAction = this.actions.get(toId);
    const toClipInfo = this.clips.get(toId);

    if (!fromAction || !toAction || !toClipInfo) {
      throw new Error('Animations not found');
    }

    fromAction.fadeOut(duration);
    toAction.fadeIn(duration);
    toAction.play();

    this.currentAnimation = toId;
    this.state.isPlaying = true;
    this.state.isPaused = false;
    this.state.duration = toClipInfo.duration;
    this.state.currentTime = 0;
  }

  /**
   * Get current animation state
   */
  public getState(): AnimationState {
    return { ...this.state };
  }

  /**
   * Get current animation ID
   */
  public getCurrentAnimation(): string | null {
    return this.currentAnimation;
  }

  /**
   * Get animation clip info
   */
  public getClipInfo(id: string): AnimationClipInfo | undefined {
    return this.clips.get(id);
  }

  /**
   * Get all animation clips
   */
  public getAllClips(): AnimationClipInfo[] {
    return Array.from(this.clips.values());
  }

  /**
   * Remove animation clip
   */
  public removeClip(id: string): void {
    const action = this.actions.get(id);
    if (action) {
      action.stop();
      this.actions.delete(id);
    }

    this.clips.delete(id);

    if (this.currentAnimation === id) {
      this.currentAnimation = null;
      this.state.isPlaying = false;
      this.state.isPaused = false;
      this.state.currentTime = 0;
    }
  }

  /**
   * Clear all animations
   */
  public clear(): void {
    this.actions.forEach((action) => {
      action.stop();
    });

    this.actions.clear();
    this.clips.clear();
    this.currentAnimation = null;
    this.state.isPlaying = false;
    this.state.isPaused = false;
    this.state.currentTime = 0;
    this.state.duration = 0;
  }

  /**
   * Dispose animation manager
   */
  public dispose(): void {
    this.clear();
    this.mixer = null;
    this.clock = new THREE.Clock();
  }

  /**
   * Check if animation manager is initialized
   */
  public isInitialized(): boolean {
    return this.mixer !== null;
  }
}
