/**
 * Idle Animation Controller
 * Manages breathing and blinking animations for VRM models
 */

import * as THREE from 'three';
import { VRM } from '@pixiv/three-vrm';
import { BlendShapeManager } from './BlendShapeManager';
import { BreathingBones } from '../../../constants/boneNames';

/**
 * Breathing configuration
 */
export interface BreathingConfig {
  enabled: boolean;
  rate: number; // breaths per minute
  depth: number; // 0-1, how deep the breath is
  chestExpansion: number; // 0-1, how much chest expands
  shoulderMovement: number; // 0-1, how much shoulders move
}

/**
 * Blinking configuration
 */
export interface BlinkingConfig {
  enabled: boolean;
  frequency: number; // blinks per minute
  minDuration: number; // minimum blink duration in seconds
  maxDuration: number; // maximum blink duration in seconds
  randomize: boolean; // randomize blink timing
}

/**
 * Idle animation state
 */
export interface IdleAnimationState {
  breathing: BreathingConfig;
  blinking: BlinkingConfig;
  isRunning: boolean;
}

/**
 * Idle Animation Controller class
 */
export class IdleAnimationController {
  private vrm: VRM | null = null;
  private blendShapeManager: BlendShapeManager | null = null;
  private state: IdleAnimationState = {
    breathing: {
      enabled: true,
      rate: 12, // 12 breaths per minute (average)
      depth: 0.5,
      chestExpansion: 0.02,
      shoulderMovement: 0.01,
    },
    blinking: {
      enabled: true,
      frequency: 15, // 15 blinks per minute (average)
      minDuration: 0.1,
      maxDuration: 0.2,
      randomize: true,
    },
    isRunning: false,
  };

  private clock: THREE.Clock = new THREE.Clock();
  private breathingTime: number = 0;
  private blinkTimer: number = 0;
  private nextBlinkTime: number = 0;
  private isBlinking: boolean = false;
  private blinkDuration: number = 0;
  private blinkProgress: number = 0;

  // Store original bone rotations
  private originalRotations: Map<string, THREE.Quaternion> = new Map();

  /**
   * Initialize idle animation controller with VRM and blend shape manager
   */
  public initialize(vrm: VRM, blendShapeManager: BlendShapeManager): void {
    this.vrm = vrm;
    this.blendShapeManager = blendShapeManager;
    this.clock.start();
    this.breathingTime = 0;
    this.blinkTimer = 0;
    this.nextBlinkTime = this.calculateNextBlinkTime();
    this.isBlinking = false;
    this.blinkProgress = 0;

    // Store original bone rotations
    this.storeOriginalRotations();
  }

  /**
   * Store original bone rotations for breathing animation
   */
  private storeOriginalRotations(): void {
    if (!this.vrm || !this.vrm.humanoid) return;

    BreathingBones.forEach((boneName) => {
      const bone = this.vrm!.humanoid.getNormalizedBoneNode(boneName);
      if (bone) {
        this.originalRotations.set(boneName, bone.quaternion.clone());
      }
    });
  }

  /**
   * Calculate next blink time
   */
  private calculateNextBlinkTime(): number {
    const config = this.state.blinking;
    const interval = 60 / config.frequency; // seconds between blinks
    
    if (config.randomize) {
      // Add random variation (±50%)
      const variation = interval * 0.5;
      return interval + (Math.random() - 0.5) * variation;
    }
    
    return interval;
  }

  /**
   * Update idle animations
   */
  public update(): void {
    if (!this.state.isRunning) return;

    const deltaTime = this.clock.getDelta();
    const cappedDt = Math.min(deltaTime, 0.1);  // Cap at 100ms to prevent large jumps

    // Update breathing
    if (this.state.breathing.enabled) {
      this.updateBreathing(cappedDt);
    }

    // Update blinking
    if (this.state.blinking.enabled) {
      this.updateBlinking(cappedDt);
    }
  }

  /**
   * Update breathing animation
   */
  private updateBreathing(deltaTime: number): void {
    if (!this.vrm || !this.vrm.humanoid) return;

    const config = this.state.breathing;
    this.breathingTime += deltaTime;

    // Calculate breathing phase (0-1, sine wave)
    const breathingPeriod = 60 / config.rate; // seconds per breath
    const phase = (Math.sin((this.breathingTime / breathingPeriod) * Math.PI * 2) + 1) / 2;

    // Apply breathing to chest and shoulders
    BreathingBones.forEach((boneName) => {
      const bone = this.vrm!.humanoid!.getNormalizedBoneNode(boneName);
      const originalRotation = this.originalRotations.get(boneName);

      if (bone && originalRotation) {
        // Calculate breathing offset based on bone
        let breathingOffset = 0;

        if (boneName === 'spine' || boneName === 'chest' || boneName === 'upperChest') {
          breathingOffset = phase * config.chestExpansion * config.depth;
        } else if (boneName === 'leftShoulder' || boneName === 'rightShoulder') {
          breathingOffset = phase * config.shoulderMovement * config.depth;
        }

        // Apply breathing as subtle rotation
        const breathingQuaternion = new THREE.Quaternion();
        breathingQuaternion.setFromEuler(new THREE.Euler(0, 0, breathingOffset));
        
        bone.quaternion.copy(originalRotation).multiply(breathingQuaternion);
      }
    });
  }

  /**
   * Update blinking animation
   */
  private updateBlinking(deltaTime: number): void {
    if (!this.blendShapeManager) return;

    this.blinkTimer += deltaTime;

    if (!this.isBlinking) {
      // Check if it's time to blink
      if (this.blinkTimer >= this.nextBlinkTime) {
        this.startBlink();
      }
    } else {
      // Update blink progress
      this.blinkProgress += deltaTime / this.blinkDuration;

      if (this.blinkProgress >= 1) {
        // Blink complete
        this.endBlink();
      } else {
        // Update blink value (ease in-out)
        const blinkValue = this.easeInOutQuad(this.blinkProgress);
        this.blendShapeManager.setBothEyesBlink(blinkValue);
      }
    }
  }

  /**
   * Start a blink
   */
  private startBlink(): void {
    const config = this.state.blinking;
    this.isBlinking = true;
    this.blinkProgress = 0;
    this.blinkDuration = config.minDuration + Math.random() * (config.maxDuration - config.minDuration);
  }

  /**
   * End a blink
   */
  private endBlink(): void {
    this.isBlinking = false;
    this.blinkTimer = 0;
    this.nextBlinkTime = this.calculateNextBlinkTime();
    
    // Ensure eyes are open
    if (this.blendShapeManager) {
      this.blendShapeManager.setBothEyesBlink(0);
    }
  }

  /**
   * Ease in-out quadratic function for smooth blinking
   */
  private easeInOutQuad(t: number): number {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  }

  /**
   * Start idle animations
   */
  public start(): void {
    this.state.isRunning = true;
    this.clock.start();
    this.breathingTime = 0;
    this.blinkTimer = 0;
    this.nextBlinkTime = this.calculateNextBlinkTime();
  }

  /**
   * Stop idle animations
   */
  public stop(): void {
    this.state.isRunning = false;
    
    // Reset to original state
    this.reset();
  }

  /**
   * Reset to original state
   */
  public reset(): void {
    if (!this.vrm || !this.vrm.humanoid) return;

    // Reset bone rotations
    BreathingBones.forEach((boneName) => {
      const bone = this.vrm!.humanoid!.getNormalizedBoneNode(boneName);
      const originalRotation = this.originalRotations.get(boneName);

      if (bone && originalRotation) {
        bone.quaternion.copy(originalRotation);
      }
    });

    // Reset blink
    if (this.blendShapeManager) {
      this.blendShapeManager.setBothEyesBlink(0);
    }

    this.isBlinking = false;
    this.blinkProgress = 0;
  }

  /**
   * Set breathing configuration
   */
  public setBreathingConfig(config: Partial<BreathingConfig>): void {
    this.state.breathing = { ...this.state.breathing, ...config };
  }

  /**
   * Get breathing configuration
   */
  public getBreathingConfig(): BreathingConfig {
    return { ...this.state.breathing };
  }

  /**
   * Set blinking configuration
   */
  public setBlinkingConfig(config: Partial<BlinkingConfig>): void {
    this.state.blinking = { ...this.state.blinking, ...config };
    
    // Recalculate next blink time if frequency changed
    if (config.frequency !== undefined) {
      this.nextBlinkTime = this.calculateNextBlinkTime();
    }
  }

  /**
   * Get blinking configuration
   */
  public getBlinkingConfig(): BlinkingConfig {
    return { ...this.state.blinking };
  }

  /**
   * Get idle animation state
   */
  public getState(): IdleAnimationState {
    return {
      breathing: { ...this.state.breathing },
      blinking: { ...this.state.blinking },
      isRunning: this.state.isRunning,
    };
  }

  /**
   * Check if controller is initialized
   */
  public isInitialized(): boolean {
    return this.vrm !== null && this.blendShapeManager !== null;
  }

  /**
   * Dispose idle animation controller
   */
  public dispose(): void {
    this.stop();
    this.originalRotations.clear();
    this.vrm = null;
    this.blendShapeManager = null;
  }
}
