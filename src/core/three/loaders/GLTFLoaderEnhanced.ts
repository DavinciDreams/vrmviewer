/**
 * Enhanced GLTF/GLB Loader
 * Primary loader for GLB/GLTF models with full metadata extraction
 * This is the DEFAULT loader (not VRM)
 */

import * as THREE from 'three';
import { GLTFLoader as ThreeGLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  LoaderResult,
  LoaderError,
  LoadingStage,
  ModelLoadOptions,
  Model,
  ModelFormat,
  ModelMetadata,
  AssetType,
  SkeletonType,
  SkeletonMetadata,
  MorphTargetData,
  FORMAT_CAPABILITIES,
} from '../../../types/model.types';

/**
 * Enhanced GLTF Loader Class
 */
export class GLTFLoaderEnhanced {
  private gltfLoader: ThreeGLTFLoader;

  constructor() {
    this.gltfLoader = new ThreeGLTFLoader();

    // Set up Draco decoder (optional, for compressed models)
    // this.setupDraco();
  }

  /**
   * Load GLTF/GLB from URL
   */
  async loadFromURL(
    url: string,
    options?: ModelLoadOptions
  ): Promise<LoaderResult<Model>> {
    try {
      this.updateProgress(options, 0, 100, 'INITIALIZING');

      const gltf = await this.loadGLTF(url, options);

      this.updateProgress(options, 50, 100, 'PROCESSING');

      const model = await this.extractModelData(gltf, url, 'glb');

      this.updateProgress(options, 100, 100, 'COMPLETE');

      return {
        success: true,
        data: model,
        metadata: {
          loadTime: performance.now(),
          fileSize: 0, // Will be set by caller
          format: 'glb',
        },
      };
    } catch (error) {
      return {
        success: false,
        error: this.handleError(error as Error, 'glb'),
      };
    }
  }

  /**
   * Load GLTF/GLB from File
   */
  async loadFromFile(
    file: File,
    options?: ModelLoadOptions
  ): Promise<LoaderResult<Model>> {
    try {
      this.updateProgress(options, 0, 100, 'INITIALIZING');

      const arrayBuffer = await file.arrayBuffer();
      const format = this.detectFormat(arrayBuffer);

      const result = await this.loadFromArrayBuffer(arrayBuffer, file.name, options);

      if (result.success && result.data) {
        result.data.format = format;
        result.data.fileSize = file.size;
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: this.handleError(error as Error, 'glb'),
      };
    }
  }

  /**
   * Load GLTF/GLB from ArrayBuffer
   */
  async loadFromArrayBuffer(
    arrayBuffer: ArrayBuffer,
    filename: string,
    options?: ModelLoadOptions
  ): Promise<LoaderResult<Model>> {
    try {
      this.updateProgress(options, 0, 100, 'PARSING');

      const gltf = await this.parseGLTF(arrayBuffer, options);

      this.updateProgress(options, 50, 100, 'PROCESSING');

      const format = this.detectFormat(arrayBuffer);
      const model = await this.extractModelData(gltf, filename, format);

      this.updateProgress(options, 100, 100, 'COMPLETE');

      return {
        success: true,
        data: model,
      };
    } catch (error) {
      return {
        success: false,
        error: this.handleError(error as Error, 'glb'),
      };
    }
  }

  /**
   * Detect if GLB or GLTF from content
   */
  private detectFormat(arrayBuffer: ArrayBuffer): ModelFormat {
    const view = new DataView(arrayBuffer, 0, 4);
    const magic = view.getUint32(0, true);

    // GLB magic number is 0x46546C67 ("glTF" in little endian)
    if (magic === 0x46546C67) {
      return 'glb';
    }

    return 'gltf';
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
        (progress: ProgressEvent) => {
          this.updateProgress(
            options,
            progress.loaded,
            progress.total,
            'DOWNLOADING'
          );
        },
        (error: unknown) => {
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
      // Try to parse as GLB first
      this.gltfLoader.parse(
        arrayBuffer,
        '',
        (gltf) => {
          resolve(gltf);
        },
        (error: unknown) => {
          reject(error);
        }
      );
    });
  }

  /**
   * Extract model data from loaded GLTF with full metadata
   */
  private async extractModelData(
    gltf: GLTF,
    filename: string,
    format: ModelFormat
  ): Promise<Model> {
    const scene = gltf.scene;
    const animations = gltf.animations || [];

    // Extract materials
    const materials = this.extractMaterials(gltf);

    // Extract textures
    const textures = this.extractTextures(gltf);

    // Extract skeleton
    const skeleton = this.extractSkeleton(gltf);
    const skeletonMetadata = skeleton ? this.analyzeSkeleton(skeleton) : undefined;

    // Extract morph targets
    const morphTargets = this.extractMorphTargets(gltf);

    // Build metadata
    const metadata: ModelMetadata = {
      name: filename.replace(/\.(glb|gltf)$/i, ''),
      version: '1.0',
      author: 'Unknown', // GLTF doesn't always have author
      title: gltf.asset?.generator || filename,
      description: gltf.asset?.copyright || '',
      format,
      assetType: this.detectAssetType(skeletonMetadata),
      skeleton: skeletonMetadata,
      capabilities: FORMAT_CAPABILITIES[format],
      extras: {
        gltfVersion: gltf.asset?.version,
        generator: gltf.asset?.generator,
        copyright: gltf.asset?.copyright,
      },
    };

    // Count geometry
    let vertexCount = 0;
    let triangleCount = 0;
    let meshCount = 0;

    scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        meshCount++;
        const geometry = object.geometry;

        if (geometry.attributes.position) {
          vertexCount += geometry.attributes.position.count;
        }

        if (geometry.index) {
          triangleCount += geometry.index.count / 3;
        } else if (geometry.attributes.position) {
          triangleCount += geometry.attributes.position.count / 3;
        }
      }
    });

    return {
      scene,
      format,
      metadata,
      skeleton,
      skeletonMetadata,
      animations: animations.length > 0 ? animations : undefined,
      morphTargets: morphTargets.size > 0 ? morphTargets : undefined,
      materials,
      textures,
      vertexCount,
      triangleCount,
      meshCount,
    };
  }

  /**
   * Extract materials from GLTF
   */
  private extractMaterials(gltf: GLTF): THREE.Material[] {
    const materials: THREE.Material[] = [];

    gltf.scene.traverse((object) => {
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

    return materials;
  }

  /**
   * Extract textures from GLTF
   */
  private extractTextures(gltf: GLTF): THREE.Texture[] {
    const textures: THREE.Texture[] = [];
    const seen = new Set<string>();

    gltf.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        const mesh = object as THREE.Mesh;

        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];

        materials.forEach((material) => {
          if (material instanceof THREE.MeshStandardMaterial) {
            [
              material.map,
              material.normalMap,
              material.roughnessMap,
              material.metalnessMap,
              material.aoMap,
              material.emissiveMap,
            ].forEach((texture) => {
              if (texture && !seen.has(texture.uuid)) {
                seen.add(texture.uuid);
                textures.push(texture);
              }
            });
          }
        });
      }
    });

    return textures;
  }

  /**
   * Extract skeleton from GLTF
   */
  private extractSkeleton(gltf: GLTF): THREE.Skeleton | undefined {
    const bones: THREE.Bone[] = [];
    const boneInverses: THREE.Matrix4[] = [];

    gltf.scene.traverse((object) => {
      if (object instanceof THREE.Bone) {
        bones.push(object);
        boneInverses.push(object.matrixWorld.clone().invert());
      }
    });

    if (bones.length > 0) {
      return new THREE.Skeleton(bones, boneInverses);
    }

    return undefined;
  }

  /**
   * Analyze skeleton to determine type
   */
  private analyzeSkeleton(skeleton: THREE.Skeleton): SkeletonMetadata {
    const bones = skeleton.bones;
    const boneNames = bones.map((b) => b.name.toLowerCase());
    const boneCount = bones.length;

    // Detect humanoid
    if (this.hasHumanoidBones(boneNames)) {
      return {
        type: SkeletonType.HUMANOID,
        boneCount,
        hasMorphTargets: false, // Will be updated elsewhere
        rigging: 'humanoid',
        boneNames: bones.map((b) => b.name),
        rootBone: bones[0]?.name,
      };
    }

    // Detect quadruped
    if (this.hasQuadrupedBones(boneNames)) {
      return {
        type: SkeletonType.QUADRUPED,
        boneCount,
        hasMorphTargets: false,
        rigging: 'quadruped',
        boneNames: bones.map((b) => b.name),
        rootBone: bones[0]?.name,
      };
    }

    // Default to custom
    return {
      type: SkeletonType.CUSTOM,
      boneCount,
      hasMorphTargets: false,
      boneNames: bones.map((b) => b.name),
      rootBone: bones[0]?.name,
    };
  }

  /**
   * Check if skeleton has humanoid bones
   */
  private hasHumanoidBones(boneNames: string[]): boolean {
    const requiredBones = ['hips', 'spine', 'head'];
    const hasRequired = requiredBones.every((name) =>
      boneNames.some((boneName) => boneName.includes(name))
    );

    return hasRequired && boneNames.length >= 15; // Minimum humanoid bone count
  }

  /**
   * Check if skeleton has quadruped bones
   */
  private hasQuadrupedBones(boneNames: string[]): boolean {
    const indicators = ['hind', 'front', 'tail', 'paw', 'hoof', 'leg'];
    const matchCount = indicators.filter((indicator) =>
      boneNames.some((boneName) => boneName.includes(indicator))
    ).length;

    return matchCount >= 3;
  }

  /**
   * Extract morph targets from GLTF
   */
  private extractMorphTargets(gltf: GLTF): Map<string, MorphTargetData[]> {
    const morphTargets = new Map<string, MorphTargetData[]>();

    gltf.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        const mesh = object as THREE.Mesh;
        const geometry = mesh.geometry;

        if (geometry.morphAttributes && Object.keys(geometry.morphAttributes).length > 0) {
          const meshMorphTargets: MorphTargetData[] = [];

          Object.keys(geometry.morphAttributes.position || {}).forEach((name, index) => {
            meshMorphTargets.push({
              name,
              meshIndex: mesh.id, // Use mesh id as index
              morphTargetIndex: index,
              weight: 0,
            });
          });

          if (meshMorphTargets.length > 0) {
            morphTargets.set(mesh.uuid, meshMorphTargets);
          }
        }
      }
    });

    return morphTargets;
  }

  /**
   * Detect asset type from skeleton
   */
  private detectAssetType(skeletonMetadata?: SkeletonMetadata): AssetType {
    if (!skeletonMetadata || skeletonMetadata.type === SkeletonType.NONE) {
      return AssetType.PROP;
    }

    if (skeletonMetadata.type === SkeletonType.HUMANOID) {
      return AssetType.CHARACTER;
    }

    if (skeletonMetadata.type === SkeletonType.QUADRUPED) {
      return AssetType.CREATURE;
    }

    return AssetType.OTHER;
  }

  /**
   * Update progress callback
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
        format: 'glb',
      });
    }
  }

  /**
   * Handle error with GLTF-specific messages
   */
  private handleError(error: Error, format: ModelFormat): LoaderError {
    const message = error.message.toLowerCase();

    if (message.includes('draco')) {
      return {
        type: 'RESOURCE_MISSING',
        message: `This ${format.toUpperCase()} model uses Draco compression. Please ensure the Draco decoder is loaded.`,
        details: error,
        format,
        stage: 'PARSING',
      };
    }

    if (message.includes('not found')) {
      return {
        type: 'FILE_NOT_FOUND',
        message: `File not found`,
        details: error,
        format,
        stage: 'DOWNLOADING',
      };
    }

    if (message.includes('parse') || message.includes('invalid')) {
      return {
        type: 'PARSE_ERROR',
        message: `Failed to parse ${format.toUpperCase()} file. The file may be corrupted.`,
        details: error,
        format,
        stage: 'PARSING',
      };
    }

    if (message.includes('version')) {
      return {
        type: 'VERSION_UNSUPPORTED',
        message: `Unsupported ${format.toUpperCase()} version`,
        details: error,
        format,
        stage: 'PARSING',
      };
    }

    if (message.includes('network') || message.includes('fetch')) {
      return {
        type: 'NETWORK_ERROR',
        message: 'Network error while loading file',
        details: error,
        format,
        stage: 'DOWNLOADING',
      };
    }

    return {
      type: 'UNKNOWN',
      message: error.message,
      details: error,
      format,
      stage: 'COMPLETE',
    };
  }

  /**
   * Get supported formats
   */
  getSupportedFormats(): ModelFormat[] {
    return ['glb', 'gltf'];
  }

  /**
   * Dispose loader resources
   */
  dispose(): void {
    // GLTFLoader will be garbage collected
  }
}

/**
 * Create singleton instance
 */
export const gltfLoaderEnhanced = new GLTFLoaderEnhanced();
