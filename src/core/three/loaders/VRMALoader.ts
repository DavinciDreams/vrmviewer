/**
 * VRMA Loader
 * Loads VRMA animation files using @pixiv/three-vrm-animation library
 */

import * as THREE from 'three';
import { GLTFLoader, GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRMAnimationLoaderPlugin } from '@pixiv/three-vrm-animation';
import {
  LoaderResult,
  LoaderError,
  LoadingStage,
  ModelLoadOptions,
} from '../../../types/vrm.types';

/**
 * VRMA Model
 */
export interface VRTAModel {
  animation: THREE.AnimationClip;
  metadata: {
    name: string;
    version: string;
    author?: string;
    license?: string;
    contactInformation?: string;
    reference?: string;
    thumbnail?: string;
  };
}

/**
 * VRMA Loader Class
 */
export class VRTALoaderWrapper {
  private gltfLoader: GLTFLoader;

  constructor() {
    this.gltfLoader = new GLTFLoader();
    this.gltfLoader.register((parser) => new VRMAnimationLoaderPlugin(parser));
  }

  /**
   * Load VRMA from URL
   */
  async loadFromURL(
    url: string,
    options?: ModelLoadOptions
  ): Promise<LoaderResult<VRTAModel>> {
    try {
      this.updateProgress(options, 0, 100, 'INITIALIZING');

      const gltf = await this.loadGLTF(url, options);
      
      this.updateProgress(options, 50, 100, 'PROCESSING');
      
      const model = this.extractModelData(gltf);
      
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
    }
  }

  /**
   * Load VRMA from File
   */
  async loadFromFile(
    file: File,
    options?: ModelLoadOptions
  ): Promise<LoaderResult<VRTAModel>> {
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
   * Load VRMA from ArrayBuffer
   */
  async loadFromArrayBuffer(
    arrayBuffer: ArrayBuffer,
    options?: ModelLoadOptions
  ): Promise<LoaderResult<VRTAModel>> {
    try {
      this.updateProgress(options, 0, 100, 'PARSING');

      const gltf = await this.parseGLTF(arrayBuffer, options);
      
      this.updateProgress(options, 50, 100, 'PROCESSING');
      
      const model = this.extractModelData(gltf);
      
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
    }
  }

  /**
   * Load GLTF from URL
   */
  private loadGLTF(
    url: string,
    options?: ModelLoadOptions
  ): Promise<GLTF> {
    return new Promise((resolve, reject) => {
      this.gltfLoader.load(
        url,
        (gltf) => {
          resolve(gltf);
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
   * Parse GLTF from ArrayBuffer
   */
  private parseGLTF(
    arrayBuffer: ArrayBuffer,
    _options?: ModelLoadOptions
  ): Promise<GLTF> {
    return new Promise((resolve, reject) => {
      this.gltfLoader.parse(
        arrayBuffer,
        '',
        (gltf) => {
          resolve(gltf);
        },
        (error) => {
          reject(error);
        }
      );
    });
  }

  /**
   * Extract model data from loaded GLTF
   */
  private extractModelData(gltf: GLTF): VRTAModel {
    const animations = gltf.animations || [];
    
    if (animations.length === 0) {
      throw new Error('No animation found in VRMA file');
    }

    const animation = animations[0];
    
    // Extract metadata from VRMA
    const metadata = this.extractMetadata(gltf);
    
    return {
      animation,
      metadata,
    };
  }

  /**
   * Extract VRMA metadata
   */
  private extractMetadata(gltf: GLTF) {
    const vrmAnimations = gltf.userData.vrmAnimations;
    
    if (!vrmAnimations || vrmAnimations.length === 0) {
      return {
        name: 'Unknown Animation',
        version: '1.0',
      };
    }

    const vrmAnimation = vrmAnimations[0];
    const meta = vrmAnimation.meta;
    
    return {
      name: meta.name || 'Unknown Animation',
      version: meta.version || '1.0',
      author: meta.author,
      license: meta.licenseUrl,
      contactInformation: meta.contactInformation,
      reference: meta.reference,
      thumbnail: meta.thumbnailImage,
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
    // The GLTFLoader and its plugins will be garbage collected
    // when loader instance is no longer referenced
  }
}

/**
 * Create singleton instance
 */
export const vrmaLoader = new VRTALoaderWrapper();
