/**
 * Blend Shape Manager
 * Manages VRM blend shapes (morph targets), expressions, and lip sync
 */

import { VRM } from '@pixiv/three-vrm';
import { ExpressionPresetName, ExpressionPresets, LipSyncVisemeName, LipSyncBlendShapes, BlendShapeValue, BlendShapeMap } from '../../../constants/blendShapes';

/**
 * Blend shape target info
 */
export interface BlendShapeTarget {
  name: string;
  currentValue: BlendShapeValue;
  targetValue: BlendShapeValue;
  interpolationSpeed: number;
}

/**
 * Expression preset state
 */
export interface ExpressionState {
  preset: ExpressionPresetName;
  weight: number;
  blendShapes: BlendShapeMap;
}

/**
 * Lip sync state
 */
export interface LipSyncState {
  viseme: LipSyncVisemeName;
  weight: number;
  blendShapes: BlendShapeMap;
}

/**
 * Blend Shape Manager class
 */
export class BlendShapeManager {
  private vrm: VRM | null = null;
  private targets: Map<string, BlendShapeTarget> = new Map();
  private currentExpression: ExpressionState | null = null;
  private currentLipSync: LipSyncState | null = null;
  private interpolationFactor: number = 0.1;

  /**
   * Initialize blend shape manager with a VRM model
   */
  public initialize(vrm: VRM): void {
    this.vrm = vrm;
    this.targets.clear();
    this.currentExpression = null;
    this.currentLipSync = null;

    // Initialize all available blend shapes
    if (vrm.expressionManager) {
      const expressionNames = Object.keys(vrm.expressionManager.expressions);
      expressionNames.forEach((name: string) => {
        this.targets.set(name, {
          name,
          currentValue: 0,
          targetValue: 0,
          interpolationSpeed: 0.1,
        });
      });
    }
  }

  /**
   * Update blend shapes (interpolate towards target values)
   */
  public update(): void {
    if (!this.vrm || !this.vrm.expressionManager) return;

    this.targets.forEach((target) => {
      // Interpolate current value towards target value
      const diff = target.targetValue - target.currentValue;
      if (Math.abs(diff) > 0.001) {
        target.currentValue += diff * target.interpolationSpeed;
      } else {
        target.currentValue = target.targetValue;
      }

      // Apply to VRM
      this.vrm!.expressionManager!.setValue(target.name, target.currentValue);
    });
  }

  /**
   * Set blend shape value directly
   */
  public setBlendShape(name: string, value: BlendShapeValue): void {
    const target = this.targets.get(name);
    if (target) {
      target.targetValue = Math.max(0, Math.min(1, value));
    }
  }

  /**
   * Get blend shape value
   */
  public getBlendShape(name: string): BlendShapeValue {
    const target = this.targets.get(name);
    return target ? target.currentValue : 0;
  }

  /**
   * Set multiple blend shapes at once
   */
  public setBlendShapes(blendShapes: BlendShapeMap): void {
    Object.entries(blendShapes).forEach(([name, value]) => {
      this.setBlendShape(name, value);
    });
  }

  /**
   * Get all current blend shape values
   */
  public getAllBlendShapes(): BlendShapeMap {
    const result: BlendShapeMap = {};
    this.targets.forEach((target) => {
      result[target.name] = target.currentValue;
    });
    return result;
  }

  /**
   * Set expression preset
   */
  public setExpression(preset: ExpressionPresetName, weight: number = 1): void {
    const presetData = ExpressionPresets[preset];
    if (!presetData) {
      throw new Error(`Expression preset ${preset} not found`);
    }

    const clampedWeight = Math.max(0, Math.min(1, weight));
    this.currentExpression = {
      preset,
      weight: clampedWeight,
      blendShapes: { ...presetData.blendShapes },
    };

    // Apply expression blend shapes with weight
    Object.entries(presetData.blendShapes).forEach(([name, value]) => {
      const weightedValue = value * clampedWeight;
      this.setBlendShape(name, weightedValue);
    });
  }

  /**
   * Get current expression
   */
  public getExpression(): ExpressionState | null {
    return this.currentExpression ? { ...this.currentExpression } : null;
  }

  /**
   * Clear expression
   */
  public clearExpression(): void {
    if (this.currentExpression) {
      // Fade out current expression
      Object.entries(this.currentExpression.blendShapes).forEach(([name, value]) => {
        this.setBlendShape(name, 0);
      });
    }
    this.currentExpression = null;
  }

  /**
   * Set lip sync viseme
   */
  public setLipSync(viseme: LipSyncVisemeName, weight: number = 1): void {
    const visemeData = LipSyncBlendShapes[viseme];
    if (!visemeData) {
      throw new Error(`Lip sync viseme ${viseme} not found`);
    }

    const clampedWeight = Math.max(0, Math.min(1, weight));
    this.currentLipSync = {
      viseme,
      weight: clampedWeight,
      blendShapes: { ...visemeData.blendShapes },
    };

    // Apply lip sync blend shapes with weight
    Object.entries(visemeData.blendShapes).forEach(([name, value]) => {
      const weightedValue = value * clampedWeight;
      this.setBlendShape(name, weightedValue);
    });
  }

  /**
   * Get current lip sync
   */
  public getLipSync(): LipSyncState | null {
    return this.currentLipSync ? { ...this.currentLipSync } : null;
  }

  /**
   * Clear lip sync
   */
  public clearLipSync(): void {
    if (this.currentLipSync) {
      // Fade out current lip sync
      Object.entries(this.currentLipSync.blendShapes).forEach(([name, value]) => {
        this.setBlendShape(name, 0);
      });
    }
    this.currentLipSync = null;
  }

  /**
   * Set eye blink state
   */
  public setEyeBlink(left: number, right: number): void {
    this.setBlendShape('blinkLeft', Math.max(0, Math.min(1, left)));
    this.setBlendShape('blinkRight', Math.max(0, Math.min(1, right)));
  }

  /**
   * Set both eyes blink
   */
  public setBothEyesBlink(value: number): void {
    const clampedValue = Math.max(0, Math.min(1, value));
    this.setEyeBlink(clampedValue, clampedValue);
  }

  /**
   * Get eye blink state
   */
  public getEyeBlink(): { left: number; right: number } {
    return {
      left: this.getBlendShape('blinkLeft'),
      right: this.getBlendShape('blinkRight'),
    };
  }

  /**
   * Reset all blend shapes to neutral
   */
  public reset(): void {
    this.targets.forEach((target) => {
      target.targetValue = 0;
    });
    this.currentExpression = null;
    this.currentLipSync = null;
  }

  /**
   * Set interpolation speed for all blend shapes
   */
  public setInterpolationSpeed(speed: number): void {
    this.targets.forEach((target) => {
      target.interpolationSpeed = Math.max(0.01, Math.min(1, speed));
    });
  }

  /**
   * Set interpolation speed for specific blend shape
   */
  public setBlendShapeInterpolationSpeed(name: string, speed: number): void {
    const target = this.targets.get(name);
    if (target) {
      target.interpolationSpeed = Math.max(0.01, Math.min(1, speed));
    }
  }

  /**
   * Check if blend shape is available
   */
  public hasBlendShape(name: string): boolean {
    return this.targets.has(name);
  }

  /**
   * Get available blend shape names
   */
  public getAvailableBlendShapes(): string[] {
    return Array.from(this.targets.keys());
  }

  /**
   * Check if manager is initialized
   */
  public isInitialized(): boolean {
    return this.vrm !== null;
  }

  /**
   * Dispose blend shape manager
   */
  public dispose(): void {
    this.reset();
    this.targets.clear();
    this.vrm = null;
  }
}
