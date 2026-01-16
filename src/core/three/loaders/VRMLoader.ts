/**
 * VRM Loader
 * Loads VRM files (VRM 0.x and VRM 1.0) using @pixiv/three-vrm
 */

import * as THREE from 'three';
import { GLTFLoader, GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRM, VRMLoaderPlugin, VRMHumanBoneName } from '@pixiv/three-vrm';
import {
  VRMModel,
  LoaderResult,
  LoaderError,
  LoadingStage,
  ModelLoadOptions,
} from '../../../types/vrm.types';

/**
 * VRM Loader Class
 */
export class VRMLoader {
  private gltfLoader: GLTFLoader;

  constructor() {
    this.gltfLoader = new GLTFLoader();
    this.gltfLoader.register((parser) => new VRMLoaderPlugin(parser));
  }

  /**
   * Load VRM from URL
   */
  async loadFromURL(
    url: string,
    options?: ModelLoadOptions
  ): Promise<LoaderResult<VRMModel>> {
    try {
      this.updateProgress(options, 0, 100, 'INITIALIZING');

      const gltf = await this.loadGLTF(url, options);
      
      this.updateProgress(options, 50, 100, 'PROCESSING');
      
      const vrm = gltf.userData.vrm as VRM;
      
      if (!vrm) {
        throw new Error('VRM data not found in loaded file');
      }

      const vrmModel = this.extractVRMData(vrm, gltf);
      
      this.updateProgress(options, 100, 100, 'COMPLETE');

      return {
        success: true,
        data: vrmModel,
      };
    } catch (error) {
      return {
        success: false,
        error: this.handleError(error as Error),
      };
    }
  }

  /**
   * Load VRM from File
   */
  async loadFromFile(
    file: File,
    options?: ModelLoadOptions
  ): Promise<LoaderResult<VRMModel>> {
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
   * Load VRM from ArrayBuffer
   */
  async loadFromArrayBuffer(
    arrayBuffer: ArrayBuffer,
    options?: ModelLoadOptions
  ): Promise<LoaderResult<VRMModel>> {
    try {
      this.updateProgress(options, 0, 100, 'PARSING');

      const gltf = await this.parseGLTF(arrayBuffer);
      
      this.updateProgress(options, 50, 100, 'PROCESSING');
      
      const vrm = gltf.userData.vrm as VRM;
      
      if (!vrm) {
        throw new Error('VRM data not found in loaded file');
      }

      const vrmModel = this.extractVRMData(vrm, gltf);
      
      this.updateProgress(options, 100, 100, 'COMPLETE');

      return {
        success: true,
        data: vrmModel,
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
    arrayBuffer: ArrayBuffer
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
   * Extract VRM data from loaded VRM instance
   */
  private extractVRMData(vrm: VRM, gltf: GLTF): VRMModel {
    const metadata = this.extractMetadata(vrm);
    const expressions = this.extractExpressions(vrm);
    const humanoid = this.extractHumanoid(vrm);
    const firstPerson = this.extractFirstPerson(vrm);
    const skeleton = this.extractSkeleton(vrm);

    return {
      vrm,
      metadata,
      expressions,
      humanoid,
      firstPerson,
      scene: gltf.scene,
      skeleton,
    };
  }

  /**
   * Extract VRM metadata
   */
  private extractMetadata(vrm: VRM) {
    const meta = vrm.meta;
    const metaUnknown = meta as unknown;
    
    // Handle both VRM 0.x and VRM 1.0 metadata formats
    const baseMetadata = {
      title: (metaUnknown as { title?: string }).title || '',
      version: (metaUnknown as { version?: string }).version || '',
      author: (metaUnknown as { author?: string }).author || '',
      contactInformation: (metaUnknown as { contactInformation?: string }).contactInformation,
      reference: (metaUnknown as { reference?: string }).reference,
      thumbnail: (metaUnknown as { thumbnailImage?: string }).thumbnailImage,
    };

    // VRM 0.x specific metadata
    if ((metaUnknown as { allowedUserName?: string }).allowedUserName !== undefined) {
      return {
        ...baseMetadata,
        license: (metaUnknown as { licenseUrl?: string }).licenseUrl
          ? {
              type: 'custom' as const,
              url: (metaUnknown as { licenseUrl?: string }).licenseUrl,
            }
          : undefined,
        allowedUserName: (metaUnknown as { allowedUserName?: string }).allowedUserName,
        violentUsageName: (metaUnknown as { violentUsageName?: string }).violentUsageName,
        sexualUsageName: (metaUnknown as { sexualUsageName?: string }).sexualUsageName,
        commercialUsageName: (metaUnknown as { commercialUsageName?: string }).commercialUsageName,
        politicalOrReligiousUsageName: (metaUnknown as { politicalOrReligiousUsageName?: string }).politicalOrReligiousUsageName,
        antisocialOrHateUsageName: (metaUnknown as { antisocialOrHateUsageName?: string }).antisocialOrHateUsageName,
        creditNotation: (metaUnknown as { creditNotation?: string }).creditNotation,
        allowRedistribution: (metaUnknown as { allowRedistribution?: string }).allowRedistribution,
        modification: (metaUnknown as { modification?: string }).modification,
        otherLicenseUrl: (metaUnknown as { otherLicenseUrl?: string }).otherLicenseUrl,
      };
    }

    // VRM 1.0 metadata
    return baseMetadata;
  }

  /**
   * Extract VRM expressions
   */
  private extractExpressions(vrm: VRM): Map<string, unknown> {
    const expressions = new Map<string, unknown>();
    
    if (vrm.expressionManager) {
      const managerTyped = vrm.expressionManager as { getExpressionNames?: () => string[] };
      
      // VRM1.0 uses different API
      if (managerTyped.getExpressionNames) {
        const expressionNames = managerTyped.getExpressionNames();
        for (const name of expressionNames) {
          const expression = vrm.expressionManager.getExpression(name);
          if (expression) {
            expressions.set(name, expression);
          }
        }
      } else {
        // VRM 0.x - iterate through known presets
        const presets = [
          'aa', 'ih', 'ou', 'ee', 'oh',
          'blink', 'blinkLeft', 'blinkRight',
          'lookLeft', 'lookRight', 'lookUp', 'lookDown',
          'neutral', 'surprised', 'angry', 'sad', 'happy', 'relaxed',
        ];
        
        for (const preset of presets) {
          const expression = vrm.expressionManager.getExpression(preset);
          if (expression) {
            expressions.set(preset, expression);
          }
        }
      }
    }

    return expressions;
  }

  /**
   * Extract VRM humanoid
   */
  private extractHumanoid(vrm: VRM) {
    const humanoid = vrm.humanoid;
    const humanBones = [];
    
    if (humanoid) {
      const boneNames: VRMHumanBoneName[] = [
        'hips',
        'spine',
        'chest',
        'neck',
        'head',
        'leftEye',
        'rightEye',
        'jaw',
        'leftUpperLeg',
        'leftLowerLeg',
        'leftFoot',
        'leftToes',
        'rightUpperLeg',
        'rightLowerLeg',
        'rightFoot',
        'rightToes',
        'leftShoulder',
        'leftUpperArm',
        'leftLowerArm',
        'leftHand',
        'rightShoulder',
        'rightUpperArm',
        'rightLowerArm',
        'rightHand',
      ];

      for (const boneName of boneNames) {
        const bone = humanoid.getNormalizedBoneNode(boneName);
        if (bone) {
          humanBones.push({
            bone: boneName,
            node: bone,
            axisLength: bone.userData.axisLength,
            useDefaultValues: bone.userData.useDefaultValues,
          });
        }
      }
    }

    return {
      humanBones,
    };
  }

  /**
   * Extract VRM first person
   */
  private extractFirstPerson(vrm: VRM): unknown {
    return vrm.firstPerson;
  }

  /**
   * Extract skeleton from VRM
   */
  private extractSkeleton(vrm: VRM): THREE.Skeleton {
    const bones: THREE.Bone[] = [];
    const boneInverses: THREE.Matrix4[] = [];
    
    // Collect all bones from humanoid
    if (vrm.humanoid) {
      const boneNames: VRMHumanBoneName[] = [
        'hips',
        'spine',
        'chest',
        'neck',
        'head',
        'leftEye',
        'rightEye',
        'jaw',
        'leftUpperLeg',
        'leftLowerLeg',
        'leftFoot',
        'leftToes',
        'rightUpperLeg',
        'rightLowerLeg',
        'rightFoot',
        'rightToes',
        'leftShoulder',
        'leftUpperArm',
        'leftLowerArm',
        'leftHand',
        'rightShoulder',
        'rightUpperArm',
        'rightLowerArm',
        'rightHand',
      ];

      for (const boneName of boneNames) {
        const bone = vrm.humanoid.getNormalizedBoneNode(boneName);
        if (bone) {
          const threeBone = bone as THREE.Bone;
          bones.push(threeBone);
          boneInverses.push(threeBone.matrixWorld.clone().invert());
        }
      }
    }

    return new THREE.Skeleton(bones, boneInverses);
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
    // when the loader instance is no longer referenced
  }
}

/**
 * Create singleton instance
 */
export const vrmLoader = new VRMLoader();
