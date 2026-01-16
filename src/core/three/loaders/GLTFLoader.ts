/**
 * GLTF/GLB Loader
 * Loads GLTF and GLB model files using Three.js GLTFLoader
 */

import * as THREE from 'three';
import { GLTFLoader, GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  LoaderResult,
  LoaderError,
  LoadingStage,
  ModelLoadOptions,
} from '../../../types/vrm.types';

/**
 * GLTF Model
 */
export interface GLTFModel {
  scene: THREE.Group;
  animations: THREE.AnimationClip[];
  skeleton?: THREE.Skeleton;
  materials: THREE.Material[];
  textures: THREE.Texture[];
}

/**
 * GLTF Loader Class
 */
export class GLTFLoaderWrapper {
  private gltfLoader: GLTFLoader;

  constructor() {
    this.gltfLoader = new GLTFLoader();
  }

  /**
   * Load GLTF/GLB from URL
   */
  async loadFromURL(
    url: string,
    options?: ModelLoadOptions
  ): Promise<LoaderResult<GLTFModel>> {
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
   * Load GLTF/GLB from File
   */
  async loadFromFile(
    file: File,
    options?: ModelLoadOptions
  ): Promise<LoaderResult<GLTFModel>> {
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
   * Load GLTF/GLB from ArrayBuffer
   */
  async loadFromArrayBuffer(
    arrayBuffer: ArrayBuffer,
    options?: ModelLoadOptions
  ): Promise<LoaderResult<GLTFModel>> {
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
    _options?: ModelLoadOptions
  ): Promise<GLTF> {
    return new Promise((resolve, reject) => {
      this.gltfLoader.load(
        url,
        (gltf) => {
          resolve(gltf);
        },
        (progress) => {
          this.updateProgress(
            _options,
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
  private extractModelData(gltf: GLTF): GLTFModel {
    const scene = gltf.scene;
    const animations = gltf.animations || [];
    const materials: THREE.Material[] = [];
    const textures: THREE.Texture[] = [];
    
    // Extract materials from scene
    scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        const mesh = object as THREE.Mesh;
        if (mesh.material) {
          if (Array.isArray(mesh.material)) {
            materials.push(...mesh.material);
          } else {
            materials.push(mesh.material);
          }
        }
      }
    });

    // Extract textures from materials
    materials.forEach((material) => {
      if (material instanceof THREE.MeshStandardMaterial) {
        if (material.map) {
          textures.push(material.map);
        }
        if (material.normalMap) {
          textures.push(material.normalMap);
        }
        if (material.roughnessMap) {
          textures.push(material.roughnessMap);
        }
        if (material.metalnessMap) {
          textures.push(material.metalnessMap);
        }
        if (material.aoMap) {
          textures.push(material.aoMap);
        }
        if (material.emissiveMap) {
          textures.push(material.emissiveMap);
        }
      }
    });

    // Extract skeleton if present
    let skeleton: THREE.Skeleton | undefined;
    const bones: THREE.Bone[] = [];
    const boneInverses: THREE.Matrix4[] = [];
    
    scene.traverse((object) => {
      if (object instanceof THREE.Bone) {
        bones.push(object);
        boneInverses.push(object.matrixWorld.clone().invert());
      }
    });

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
    // The GLTFLoader will be garbage collected
    // when loader instance is no longer referenced
  }
}

/**
 * Create singleton instance
 */
export const gltfLoader = new GLTFLoaderWrapper();
