/**
 * Unified Loader Manager
 * Manages all model and animation loaders and provides a unified interface
 */

import * as THREE from 'three';
import { vrmLoader } from './VRMLoader';
import { gltfLoader } from './GLTFLoader';
import { fbxLoader } from './FBXLoader';
import { bvhLoader } from './BVHLoader';
import { vrmaLoader } from './VRMALoader';
import {
  LoaderError,
  LoadingStage,
  ModelLoadOptions,
  ModelFormat,
  ModelFileType,
} from '../../../types/vrm.types';
import {
  getFileExtension,
  getFormatFromExtension,
  getFileTypeFromExtension,
  isFileSupported,
} from '../../../constants/formats';

/**
 * Unified Load Result
 */
export interface UnifiedLoadResult {
  success: boolean;
  data?: {
    model?: THREE.Group;
    animation?: THREE.AnimationClip;
    metadata?: {
      name: string;
      format: ModelFormat;
      type: ModelFileType;
    };
  };
  error?: LoaderError;
  warnings?: string[];
}

/**
 * Loader Manager Class
 */
export class LoaderManager {
  /**
   * Load model or animation from URL
   */
  async loadFromURL(
    url: string,
    options?: ModelLoadOptions
  ): Promise<UnifiedLoadResult> {
    try {
      const extension = getFileExtension(url);
      const format = getFormatFromExtension(extension);
      const type = getFileTypeFromExtension(extension);

      if (!format || !type) {
        throw new Error(`Unsupported file format: ${extension}`);
      }

      this.updateProgress(options, 0, 100, 'INITIALIZING');

      let result: UnifiedLoadResult;

      switch (format) {
        case 'vrm': {
          const vrmResult = await vrmLoader.loadFromURL(url, options);
          result = this.convertVRMResult(vrmResult);
          break;
        }
        case 'gltf':
        case 'glb': {
          const gltfResult = await gltfLoader.loadFromURL(url, options);
          result = this.convertGLTFResult(gltfResult);
          break;
        }
        case 'fbx': {
          const fbxResult = await fbxLoader.loadFromURL(url, options);
          result = this.convertFBXResult(fbxResult);
          break;
        }
        case 'bvh': {
          const bvhResult = await bvhLoader.loadFromURL(url, options);
          result = this.convertBVHResult(bvhResult);
          break;
        }
        case 'vrma': {
          const vrmaResult = await vrmaLoader.loadFromURL(url, options);
          result = this.convertVRMAResult(vrmaResult);
          break;
        }
        default:
          throw new Error(`Unsupported format: ${format}`);
      }

      this.updateProgress(options, 100, 100, 'COMPLETE');

      return result;
    } catch (error) {
      return {
        success: false,
        error: this.handleError(error as Error),
      };
    }
  }

  /**
   * Load model or animation from File
   */
  async loadFromFile(
    file: File,
    options?: ModelLoadOptions
  ): Promise<UnifiedLoadResult> {
    try {
      const extension = getFileExtension(file.name);
      const format = getFormatFromExtension(extension);
      const type = getFileTypeFromExtension(extension);

      if (!format || !type) {
        throw new Error(`Unsupported file format: ${extension}`);
      }

      if (!isFileSupported(file.name)) {
        throw new Error(`File not supported: ${file.name}`);
      }

      this.updateProgress(options, 0, 100, 'INITIALIZING');

      let result: UnifiedLoadResult;

      switch (format) {
        case 'vrm':
          const vrmResult = await vrmLoader.loadFromFile(file, options);
          result = this.convertVRMResult(vrmResult);
          break;
        case 'gltf':
        case 'glb':
          const gltfResult = await gltfLoader.loadFromFile(file, options);
          result = this.convertGLTFResult(gltfResult);
          break;
        case 'fbx':
          const fbxResult = await fbxLoader.loadFromFile(file, options);
          result = this.convertFBXResult(fbxResult);
          break;
        case 'bvh':
          const bvhResult = await bvhLoader.loadFromFile(file, options);
          result = this.convertBVHResult(bvhResult);
          break;
        case 'vrma':
          const vrmaResult = await vrmaLoader.loadFromFile(file, options);
          result = this.convertVRMAResult(vrmaResult);
          break;
        default:
          throw new Error(`Unsupported format: ${format}`);
      }

      this.updateProgress(options, 100, 100, 'COMPLETE');

      return result;
    } catch (error) {
      return {
        success: false,
        error: this.handleError(error as Error),
      };
    }
  }

  /**
   * Load model or animation from ArrayBuffer
   */
  async loadFromArrayBuffer(
    arrayBuffer: ArrayBuffer,
    filename: string,
    options?: ModelLoadOptions
  ): Promise<UnifiedLoadResult> {
    try {
      const extension = getFileExtension(filename);
      const format = getFormatFromExtension(extension);
      const type = getFileTypeFromExtension(extension);

      if (!format || !type) {
        throw new Error(`Unsupported file format: ${extension}`);
      }

      this.updateProgress(options, 0, 100, 'INITIALIZING');

      let result: UnifiedLoadResult;

      switch (format) {
        case 'vrm':
          const vrmResult = await vrmLoader.loadFromArrayBuffer(arrayBuffer, options);
          result = this.convertVRMResult(vrmResult);
          break;
        case 'gltf':
        case 'glb':
          const gltfResult = await gltfLoader.loadFromArrayBuffer(arrayBuffer, options);
          result = this.convertGLTFResult(gltfResult);
          break;
        case 'fbx':
          const fbxResult = await fbxLoader.loadFromArrayBuffer(arrayBuffer, options);
          result = this.convertFBXResult(fbxResult);
          break;
        case 'bvh':
          const bvhResult = await bvhLoader.loadFromArrayBuffer(arrayBuffer, options);
          result = this.convertBVHResult(bvhResult);
          break;
        case 'vrma':
          const vrmaResult = await vrmaLoader.loadFromArrayBuffer(arrayBuffer, options);
          result = this.convertVRMAResult(vrmaResult);
          break;
        default:
          throw new Error(`Unsupported format: ${format}`);
      }

      this.updateProgress(options, 100, 100, 'COMPLETE');

      return result;
    } catch (error) {
      return {
        success: false,
        error: this.handleError(error as Error),
      };
    }
  }

  /**
   * Detect file type from content
   */
  async detectFileType(
    arrayBuffer: ArrayBuffer
  ): Promise<{ format: ModelFormat; type: ModelFileType } | null> {
    // Check file signatures
    const header = new Uint8Array(arrayBuffer.slice(0, 4));
    const headerStr = String.fromCharCode(...header);

    // GLB signature
    if (headerStr === 'glTF') {
      return { format: 'glb', type: 'model' };
    }

    // FBX signature (Kaydara)
    if (headerStr === 'Kaydara') {
      return { format: 'fbx', type: 'model' };
    }

    // BVH signature (HIERARCHY)
    const text = new TextDecoder().decode(arrayBuffer);
    if (text.trim().toUpperCase().startsWith('HIERARCHY')) {
      return { format: 'bvh', type: 'animation' };
    }

    return null;
  }

  /**
   * Convert VRM result to unified result
   */
  private convertVRMResult(
    result: { success: boolean; data?: { vrm: unknown; metadata: unknown; expressions: unknown; humanoid: unknown; firstPerson: unknown; scene: THREE.Group; skeleton: THREE.Skeleton } }
  ): UnifiedLoadResult {
    if (!result.success || !result.data) {
      return {
        success: false,
        error: { type: 'PARSE_ERROR', message: 'Failed to load VRM model' },
      };
    }

    const { metadata } = result.data;

    return {
      success: true,
      data: {
        model: result.data.scene,
        metadata: {
          name: (metadata as { title?: string }).title || 'Unknown Model',
          format: 'vrm',
          type: 'model',
        },
      },
    };
  }

  /**
   * Convert GLTF result to unified result
   */
  private convertGLTFResult(
    result: { success: boolean; data?: { scene: THREE.Group; animations: THREE.AnimationClip[]; skeleton?: THREE.Skeleton; materials: THREE.Material[]; textures: THREE.Texture[] } }
  ): UnifiedLoadResult {
    if (!result.success || !result.data) {
      return {
        success: false,
        error: { type: 'PARSE_ERROR', message: 'Failed to load GLTF model' },
      };
    }

    const { scene, animations } = result.data;

    return {
      success: true,
      data: {
        model: scene,
        animation: animations[0],
        metadata: {
          name: 'GLTF Model',
          format: 'gltf',
          type: 'model',
        },
      },
    };
  }

  /**
   * Convert FBX result to unified result
   */
  private convertFBXResult(
    result: { success: boolean; data?: { scene: THREE.Group; animations: THREE.AnimationClip[]; skeleton?: THREE.Skeleton; materials: THREE.Material[]; textures: THREE.Texture[] } }
  ): UnifiedLoadResult {
    if (!result.success || !result.data) {
      return {
        success: false,
        error: { type: 'PARSE_ERROR', message: 'Failed to load FBX model' },
      };
    }

    const { scene, animations } = result.data;

    return {
      success: true,
      data: {
        model: scene,
        animation: animations[0],
        metadata: {
          name: 'FBX Model',
          format: 'fbx',
          type: 'model',
        },
      },
    };
  }

  /**
   * Convert BVH result to unified result
   */
  private convertBVHResult(
    result: { success: boolean; data?: { scene: THREE.Group; animation: THREE.AnimationClip; skeleton: THREE.Skeleton; hierarchy: unknown[] } }
  ): UnifiedLoadResult {
    if (!result.success || !result.data) {
      return {
        success: false,
        error: { type: 'PARSE_ERROR', message: 'Failed to load BVH animation' },
      };
    }

    const { scene, animation } = result.data;

    return {
      success: true,
      data: {
        model: scene,
        animation,
        metadata: {
          name: 'BVH Animation',
          format: 'bvh',
          type: 'animation',
        },
      },
    };
  }

  /**
   * Convert VRMA result to unified result
   */
  private convertVRMAResult(
    result: { success: boolean; data?: { animation: THREE.AnimationClip; metadata: { name: string; version: string; author?: string; license?: string; contactInformation?: string; reference?: string; thumbnail?: string } } }
  ): UnifiedLoadResult {
    if (!result.success || !result.data) {
      return {
        success: false,
        error: { type: 'PARSE_ERROR', message: 'Failed to load VRMA animation' },
      };
    }

    const { animation, metadata } = result.data;

    return {
      success: true,
      data: {
        animation,
        metadata: {
          name: metadata.name || 'Unknown Animation',
          format: 'vrma',
          type: 'animation',
        },
      },
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
   * Dispose all loaders
   */
  dispose(): void {
    vrmLoader.dispose();
    gltfLoader.dispose();
    fbxLoader.dispose();
    bvhLoader.dispose();
    vrmaLoader.dispose();
  }
}

/**
 * Create singleton instance
 */
export const loaderManager = new LoaderManager();
