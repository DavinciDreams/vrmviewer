/**
 * FBX Loader
 * Loads FBX model files using Three.js FBXLoader
 */

import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import {
  LoaderResult,
  LoaderError,
  LoadingStage,
  ModelLoadOptions,
} from '../../../types/vrm.types';

/**
 * FBX Model
 */
export interface FBXModel {
  scene: THREE.Group;
  animations: THREE.AnimationClip[];
  skeleton?: THREE.Skeleton;
  materials: THREE.Material[];
  textures: THREE.Texture[];
}

/**
 * FBX Loader Class
 */
export class FBXLoaderWrapper {
  private fbxLoader: FBXLoader;
  private originalConsoleWarn: typeof console.warn;
  private warningCounts: Map<string, number>;
  private suppressedWarnings: Set<string>;

  constructor() {
    this.fbxLoader = new FBXLoader();
    this.originalConsoleWarn = console.warn;
    this.warningCounts = new Map();
    this.suppressedWarnings = new Set([
      'THREE.FBXLoader: Vertex has more than 4 skinning weights assigned to vertex. Deleting additional weights.',
    ]);
  }

  /**
   * Suppress console warnings during loading
   */
  private suppressWarnings(): void {
    this.warningCounts.clear();
    console.warn = (...args: unknown[]) => {
      const message = args.join(' ');
      
      // Check if this warning should be suppressed
      for (const suppressedWarning of this.suppressedWarnings) {
        if (message.includes(suppressedWarning)) {
          const count = this.warningCounts.get(suppressedWarning) || 0;
          this.warningCounts.set(suppressedWarning, count + 1);
          return; // Suppress the warning
        }
      }
      
      // Pass through non-suppressed warnings
      this.originalConsoleWarn.apply(console, args);
    };
  }

  /**
   * Restore console warnings and log summary
   */
  private restoreWarnings(): void {
    console.warn = this.originalConsoleWarn;
    
    // Log a summary of suppressed warnings
    if (this.warningCounts.size > 0) {
      for (const [warning, count] of this.warningCounts.entries()) {
        this.originalConsoleWarn(
          `THREE.FBXLoader: ${warning} (suppressed ${count} times)`
        );
      }
    }
  }

  /**
   * Load FBX from URL
   */
  async loadFromURL(
    url: string,
    options?: ModelLoadOptions
  ): Promise<LoaderResult<FBXModel>> {
    this.suppressWarnings();
    try {
      this.updateProgress(options, 0, 100, 'INITIALIZING');

      const object = await this.loadFBX(url, options);
      
      this.updateProgress(options, 50, 100, 'PROCESSING');
      
      const model = this.extractModelData(object);
      
      this.updateProgress(options, 100, 100, 'COMPLETE');

      return {
        success: true,
        data: model,
      };
    } catch (error) {
      return {
        success: false,
        error: this.handleError(error as Error),
      };
    } finally {
      this.restoreWarnings();
    }
  }

  /**
   * Load FBX from File
   */
  async loadFromFile(
    file: File,
    options?: ModelLoadOptions
  ): Promise<LoaderResult<FBXModel>> {
    try {
      this.updateProgress(options, 0, 100, 'INITIALIZING');

      const arrayBuffer = await file.arrayBuffer();
      return await this.loadFromArrayBuffer(arrayBuffer, options);
    } catch (error) {
      return {
        success: false,
        error: this.handleError(error as Error),
      };
    }
  }

  /**
   * Load FBX from ArrayBuffer
   */
  async loadFromArrayBuffer(
    arrayBuffer: ArrayBuffer,
    options?: ModelLoadOptions
  ): Promise<LoaderResult<FBXModel>> {
    this.suppressWarnings();
    try {
      this.updateProgress(options, 0, 100, 'PARSING');

      const object = await this.parseFBX(arrayBuffer);
      
      this.updateProgress(options, 50, 100, 'PROCESSING');
      
      const model = this.extractModelData(object);
      
      this.updateProgress(options, 100, 100, 'COMPLETE');

      return {
        success: true,
        data: model,
      };
    } catch (error) {
      return {
        success: false,
        error: this.handleError(error as Error),
      };
    } finally {
      this.restoreWarnings();
    }
  }

  /**
   * Load FBX from URL
   */
  private loadFBX(
    url: string,
    options?: ModelLoadOptions
  ): Promise<THREE.Object3D> {
    return new Promise((resolve, reject) => {
      this.fbxLoader.load(
        url,
        (object) => {
          resolve(object);
        },
        (progress) => {
          this.updateProgress(
            options,
            progress.loaded,
            progress.total,
            'DOWNLOADING'
          );
        },
        (error) => {
          reject(error);
        }
      );
    });
  }

  /**
   * Parse FBX from ArrayBuffer
   */
  private parseFBX(
    arrayBuffer: ArrayBuffer
  ): Promise<THREE.Object3D> {
    return new Promise((resolve, reject) => {
      try {
        const object = this.fbxLoader.parse(arrayBuffer, '' as string);
        resolve(object);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Extract model data from loaded FBX object
   * Optimized to use a single traversal instead of multiple traversals
   */
  private extractModelData(object: THREE.Object3D): FBXModel {
    const scene = new THREE.Group();
    scene.add(object);
    
    const animations: THREE.AnimationClip[] = [];
    const materials: THREE.Material[] = [];
    const textures: THREE.Texture[] = [];
    const bones: THREE.Bone[] = [];
    const boneInverses: THREE.Matrix4[] = [];
    const textureSet = new Set<THREE.Texture>();
    
    // Extract animations from object
    if (object.animations && object.animations.length > 0) {
      animations.push(...object.animations);
    }
    
    // Single traversal to extract materials, textures, and bones
    object.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const mesh = child as THREE.Mesh;
        if (mesh.material) {
          // Collect materials
          if (Array.isArray(mesh.material)) {
            materials.push(...mesh.material);
          } else {
            materials.push(mesh.material);
          }
        }
      } else if (child instanceof THREE.Bone) {
        // Collect bones
        bones.push(child);
        boneInverses.push(child.matrixWorld.clone().invert());
      }
    });

    // Extract textures from materials (using Set to avoid duplicates)
    for (const material of materials) {
      if (material instanceof THREE.MeshStandardMaterial) {
        const textureMaps: (THREE.Texture | null | undefined)[] = [
          material.map,
          material.normalMap,
          material.roughnessMap,
          material.metalnessMap,
          material.aoMap,
          material.emissiveMap,
        ];
        
        for (const texture of textureMaps) {
          if (texture && !textureSet.has(texture)) {
            textureSet.add(texture);
            textures.push(texture);
          }
        }
      }
    }

    // Create skeleton if bones were found
    let skeleton: THREE.Skeleton | undefined;
    if (bones.length > 0) {
      skeleton = new THREE.Skeleton(bones, boneInverses);
    }

    return {
      scene,
      animations,
      skeleton,
      materials,
      textures,
    };
  }

  /**
   * Update progress
   */
  private updateProgress(
    options: ModelLoadOptions | undefined,
    loaded: number,
    total: number,
    stage: LoadingStage
  ): void {
    if (options?.progressCallback) {
      const percentage = total > 0 ? (loaded / total) * 100 : 0;
      options.progressCallback({
        loaded,
        total,
        percentage,
        stage,
      });
    }
  }

  /**
   * Handle error
   */
  private handleError(error: Error): LoaderError {
    const type: LoaderError['type'] = 'UNKNOWN';
    const message = error.message;

    if (message.includes('not found')) {
      return { type: 'FILE_NOT_FOUND', message, stack: error.stack };
    } else if (message.includes('parse') || message.includes('invalid')) {
      return { type: 'PARSE_ERROR', message, stack: error.stack };
    } else if (message.includes('version')) {
      return { type: 'VERSION_UNSUPPORTED', message, stack: error.stack };
    } else if (message.includes('network') || message.includes('fetch')) {
      return { type: 'NETWORK_ERROR', message, stack: error.stack };
    }

    return { type, message, stack: error.stack };
  }

  /**
   * Dispose loader resources
   */
  dispose(): void {
    // The FBXLoader will be garbage collected
    // when loader instance is no longer referenced
  }
}

/**
 * Create singleton instance
 */
export const fbxLoader = new FBXLoaderWrapper();
