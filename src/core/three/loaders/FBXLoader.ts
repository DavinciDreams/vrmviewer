/**
 * Enhanced FBX Loader
 * Loads FBX model files using Three.js FBXLoader with enhanced compatibility
 * Supports animations, materials, textures, skinning, and morph targets
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
 * FBX Model with enhanced features
 */
export interface FBXModel {
  scene: THREE.Group;
  animations: THREE.AnimationClip[];
  skeleton?: THREE.Skeleton;
  materials: THREE.Material[];
  textures: THREE.Texture[];
  morphTargets?: Map<string, THREE.MorphTarget[]>;
  blendShapes?: Map<string, THREE.MorphTarget[]>;
  metadata?: FBXMetadata;
}

/**
 * FBX Metadata
 */
export interface FBXMetadata {
  version?: number;
  author?: string;
  creationDate?: string;
  application?: string;
  unitScale?: number;
  upAxis?: 'X' | 'Y' | 'Z';
  frontAxis?: 'X' | 'Y' | 'Z';
}

/**
 * Enhanced FBX Loader Class
 */
export class FBXLoaderWrapper {
  private fbxLoader: FBXLoader;
  private originalConsoleWarn: typeof console.warn;
  private originalConsoleError: typeof console.error;
  private warningCounts: Map<string, number>;
  private errorCounts: Map<string, number>;
  private suppressedWarnings: Set<string>;
  private suppressedErrors: Set<string>;

  constructor() {
    this.fbxLoader = new FBXLoader();
    this.originalConsoleWarn = console.warn;
    this.originalConsoleError = console.error;
    this.warningCounts = new Map();
    this.errorCounts = new Map();
    this.suppressedWarnings = new Set([
      'THREE.FBXLoader: Vertex has more than 4 skinning weights assigned to vertex. Deleting additional weights.',
      'THREE.FBXLoader: Morph target count mismatch.',
      'THREE.FBXLoader: Animation clip',
      'THREE.FBXLoader: Deformer',
    ]);
    this.suppressedErrors = new Set([
      'THREE.FBXLoader: Unknown attribute',
    ]);
  }

  /**
   * Suppress console warnings and errors during loading
   */
  private suppressWarnings(): void {
    this.warningCounts.clear();
    this.errorCounts.clear();
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

    console.error = (...args: unknown[]) => {
      const message = args.join(' ');
      
      // Check if this error should be suppressed
      for (const suppressedError of this.suppressedErrors) {
        if (message.includes(suppressedError)) {
          const count = this.errorCounts.get(suppressedError) || 0;
          this.errorCounts.set(suppressedError, count + 1);
          return; // Suppress the error
        }
      }
      
      // Pass through non-suppressed errors
      this.originalConsoleError.apply(console, args);
    };
  }

  /**
   * Restore console warnings and errors and log summary
   */
  private restoreWarnings(): void {
    console.warn = this.originalConsoleWarn;
    console.error = this.originalConsoleError;
    
    // Log a summary of suppressed warnings
    if (this.warningCounts.size > 0) {
      for (const [warning, count] of this.warningCounts.entries()) {
        this.originalConsoleWarn(
          `THREE.FBXLoader: ${warning} (suppressed ${count} times)`
        );
      }
    }

    // Log a summary of suppressed errors
    if (this.errorCounts.size > 0) {
      for (const [error, count] of this.errorCounts.entries()) {
        this.originalConsoleError(
          `THREE.FBXLoader: ${error} (suppressed ${count} times)`
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
      
      this.updateProgress(options, 30, 100, 'PROCESSING');
      
      const model = this.extractModelData(object, url);
      
      this.updateProgress(options, 80, 100, 'FINALIZING');

      // Post-process the model
      this.postProcessModel(model);
      
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
      return await this.loadFromArrayBuffer(arrayBuffer, file.name, options);
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
    filename: string,
    options?: ModelLoadOptions
  ): Promise<LoaderResult<FBXModel>> {
    this.suppressWarnings();
    try {
      this.updateProgress(options, 0, 100, 'PARSING');

      const object = await this.parseFBX(arrayBuffer);
      
      this.updateProgress(options, 30, 100, 'PROCESSING');
      
      const model = this.extractModelData(object, filename);
      
      this.updateProgress(options, 80, 100, 'FINALIZING');

      // Post-process the model
      this.postProcessModel(model);
      
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
   * Enhanced to support more FBX features
   */
  private extractModelData(object: THREE.Object3D, filename: string): FBXModel {
    const scene = new THREE.Group();
    scene.name = filename.replace(/\.[^/.]+$/, '') || 'FBXModel';
    scene.add(object);
    
    const animations: THREE.AnimationClip[] = [];
    const materials: THREE.Material[] = [];
    const textures: THREE.Texture[] = [];
    const bones: THREE.Bone[] = [];
    const boneInverses: THREE.Matrix4[] = [];
    const textureSet = new Set<THREE.Texture>();
    const morphTargets = new Map<string, THREE.MorphTarget[]>();
    const blendShapes = new Map<string, THREE.MorphTarget[]>();
    
    // Extract animations from object
    if (object.animations && object.animations.length > 0) {
      animations.push(...object.animations);
      this.originalConsoleWarn(`Loaded ${animations.length} animation(s) from FBX`);
    }
    
    // Single traversal to extract materials, textures, bones, and morph targets
    object.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const mesh = child as THREE.Mesh;
        
        // Collect materials
        if (mesh.material) {
          if (Array.isArray(mesh.material)) {
            materials.push(...mesh.material);
          } else {
            materials.push(mesh.material);
          }
        }

        // Extract morph targets
        if (mesh.morphTargetInfluences && mesh.morphTargetInfluences.length > 0) {
          const geometry = mesh.geometry;
          if (geometry.morphAttributes && geometry.morphAttributes.position) {
            const morphAttributes = geometry.morphAttributes.position;
            const targets: THREE.MorphTarget[] = [];
            
            for (let i = 0; i < morphAttributes.length; i++) {
              const morphAttribute = morphAttributes[i];
              if (morphAttribute) {
                targets.push({
                  name: mesh.name || `morph_${i}`,
                  influences: mesh.morphTargetInfluences,
                  attribute: morphAttribute,
                } as unknown as THREE.MorphTarget);
              }
            }
            
            if (targets.length > 0) {
              morphTargets.set(mesh.name, targets);
              
              // Also add to blendShapes if it looks like a facial expression
              if (this.isLikelyBlendShape(mesh.name)) {
                blendShapes.set(mesh.name, targets);
              }
            }
          }
        }

        // Ensure mesh has proper skinning setup
        if (mesh instanceof THREE.SkinnedMesh && mesh.skeleton) {
          const skeletonBones = mesh.skeleton.bones;
          for (const bone of skeletonBones) {
            if (!bones.includes(bone)) {
              bones.push(bone);
              boneInverses.push(bone.matrixWorld.clone().invert());
            }
          }
        }
      } else if (child instanceof THREE.Bone) {
        // Collect bones
        if (!bones.includes(child)) {
          bones.push(child);
          boneInverses.push(child.matrixWorld.clone().invert());
        }
      } else if (child instanceof THREE.SkinnedMesh) {
        // Extract skeleton from skinned mesh
        const skinnedMesh = child as THREE.SkinnedMesh;
        if (skinnedMesh.skeleton) {
          const skeletonBones = skinnedMesh.skeleton.bones;
          for (const bone of skeletonBones) {
            if (!bones.includes(bone)) {
              bones.push(bone);
              boneInverses.push(bone.matrixWorld.clone().invert());
            }
          }
        }
      }
    });

    // Extract textures from materials (using Set to avoid duplicates)
    for (const material of materials) {
      this.extractTexturesFromMaterial(material, textureSet, textures);
    }

    // Create skeleton if bones were found
    let skeleton: THREE.Skeleton | undefined;
    if (bones.length > 0) {
      skeleton = new THREE.Skeleton(bones, boneInverses);
      this.originalConsoleWarn(`Created skeleton with ${bones.length} bones`);
    }

    // Extract metadata from FBX object
    const metadata = this.extractMetadata(object);

    return {
      scene,
      animations,
      skeleton,
      materials,
      textures,
      morphTargets: morphTargets.size > 0 ? morphTargets : undefined,
      blendShapes: blendShapes.size > 0 ? blendShapes : undefined,
      metadata,
    };
  }

  /**
   * Extract textures from material
   */
  private extractTexturesFromMaterial(
    material: THREE.Material,
    textureSet: Set<THREE.Texture>,
    textures: THREE.Texture[]
  ): void {
    if (material instanceof THREE.MeshStandardMaterial) {
      const textureMaps: (THREE.Texture | null | undefined)[] = [
        material.map,
        material.normalMap,
        material.roughnessMap,
        material.metalnessMap,
        material.aoMap,
        material.emissiveMap,
        material.displacementMap,
      ];
      
      for (const texture of textureMaps) {
        if (texture && !textureSet.has(texture)) {
          textureSet.add(texture);
          textures.push(texture);
        }
      }
    } else if (material instanceof THREE.MeshBasicMaterial) {
      if (material.map && !textureSet.has(material.map)) {
        textureSet.add(material.map);
        textures.push(material.map);
      }
    } else if (material instanceof THREE.MeshPhysicalMaterial) {
      const textureMaps: (THREE.Texture | null | undefined)[] = [
        material.map,
        material.normalMap,
        material.roughnessMap,
        material.metalnessMap,
        material.aoMap,
        material.emissiveMap,
        material.clearcoatMap,
        material.clearcoatRoughnessMap,
        material.clearcoatNormalMap,
        material.transmissionMap,
        material.thicknessMap,
        material.sheenColorMap,
        material.sheenRoughnessMap,
      ];
      
      for (const texture of textureMaps) {
        if (texture && !textureSet.has(texture)) {
          textureSet.add(texture);
          textures.push(texture);
        }
      }
    }
  }

  /**
   * Extract metadata from FBX object
   */
  private extractMetadata(object: THREE.Object3D): FBXMetadata {
    const metadata: FBXMetadata = {};
    
    // Try to extract metadata from userData
    if (object.userData) {
      if (object.userData.version) metadata.version = object.userData.version;
      if (object.userData.author) metadata.author = object.userData.author;
      if (object.userData.creationDate) metadata.creationDate = object.userData.creationDate;
      if (object.userData.application) metadata.application = object.userData.application;
      if (object.userData.unitScale) metadata.unitScale = object.userData.unitScale;
      if (object.userData.upAxis) metadata.upAxis = object.userData.upAxis;
      if (object.userData.frontAxis) metadata.frontAxis = object.userData.frontAxis;
    }
    
    return metadata;
  }

  /**
   * Check if mesh name suggests it's a blend shape
   */
  private isLikelyBlendShape(name: string): boolean {
    const blendShapeKeywords = [
      'eye', 'mouth', 'brow', 'lip', 'cheek', 'nose', 'face',
      'blink', 'smile', 'frown', 'surprise', 'angry', 'sad',
      'morph', 'blend', 'shape', 'expression'
    ];
    
    const lowerName = name.toLowerCase();
    return blendShapeKeywords.some(keyword => lowerName.includes(keyword));
  }

  /**
   * Post-process the loaded model
   */
  private postProcessModel(model: FBXModel): void {
    // Ensure all materials have proper properties
    for (const material of model.materials) {
      this.postProcessMaterial(material);
    }

    // Ensure all textures have proper encoding
    for (const texture of model.textures) {
      this.postProcessTexture(texture);
    }

    // Ensure scene has proper scale and orientation
    this.postProcessScene(model.scene);
  }

  /**
   * Post-process material
   */
  private postProcessMaterial(material: THREE.Material): void {
    if (material instanceof THREE.MeshStandardMaterial) {
      // Ensure proper material properties
      if (material.roughness === undefined) material.roughness = 0.5;
      if (material.metalness === undefined) material.metalness = 0.0;
      if (material.color === undefined) material.color = new THREE.Color(0xffffff);
    } else if (material instanceof THREE.MeshBasicMaterial) {
      if (material.color === undefined) material.color = new THREE.Color(0xffffff);
    }
  }

  /**
   * Post-process texture
   */
  private postProcessTexture(texture: THREE.Texture): void {
    // Ensure proper texture color space (Three.js r164+)
    if (texture.colorSpace === undefined) {
      texture.colorSpace = THREE.SRGBColorSpace;
    }
    
    // Ensure proper texture filtering
    if (texture.minFilter === undefined) {
      texture.minFilter = THREE.LinearMipmapLinearFilter;
    }
    if (texture.magFilter === undefined) {
      texture.magFilter = THREE.LinearFilter;
    }
  }

  /**
   * Post-process scene
   */
  private postProcessScene(scene: THREE.Group): void {
    // Ensure scene has proper scale
    scene.updateMatrixWorld();
    
    // Ensure all meshes have proper geometry
    scene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const mesh = child as THREE.Mesh;
        if (mesh.geometry) {
          mesh.geometry.computeBoundingBox();
          mesh.geometry.computeBoundingSphere();
        }
      }
    });
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
    } else if (message.includes('memory') || message.includes('buffer')) {
      return { type: 'RESOURCE_MISSING', message, stack: error.stack };
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
