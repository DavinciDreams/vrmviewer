/**
 * VRM Helper
 * Helper functions for VRM operations
 */

import * as THREE from 'three';
import { VRM } from '@pixiv/three-vrm';
import { VRMHumanoidBoneName } from '../../../constants/boneNames';
import { BlendShapeValue, BlendShapeMap } from '../../../constants/blendShapes';

/**
 * VRM metadata
 */
export interface VRMMetadata {
  title: string;
  version: string;
  author: string;
  contactInformation: string;
  reference: string;
  thumbnail: string;
  allowedUserName: string;
  violentUsageName: string;
  sexualUsageName: string;
  commercialUsageName: string;
  otherPermissionUrl: string;
  licenseName: string;
}

/**
 * Bone position/rotation
 */
export interface BoneTransform {
  position: THREE.Vector3;
  rotation: THREE.Quaternion;
  scale: THREE.Vector3;
}

/**
 * VRM Helper class
 */
export class VRMHelper {
  /**
   * Get VRM metadata
   */
  public static getMetadata(vrm: VRM): VRMMetadata | null {
    if (!vrm.meta) return null;

    // Handle different VRM versions
    const meta = vrm.meta as VRMMetadata;
    
    return {
      title: meta.title || meta.metaName || '',
      version: meta.version || meta.metaVersion || '',
      author: meta.author || meta.metaAuthor || '',
      contactInformation: meta.contactInformation || '',
      reference: meta.reference || '',
      thumbnail: meta.thumbnailImage || meta.texture || '',
      allowedUserName: meta.allowedUserName || '',
      violentUsageName: meta.violentUsageName || '',
      sexualUsageName: meta.sexualUsageName || '',
      commercialUsageName: meta.commercialUsageName || '',
      otherPermissionUrl: meta.otherPermissionUrl || '',
      licenseName: meta.licenseName || '',
    };
  }

  /**
   * Get blend shape value
   */
  public static getBlendShapeValue(vrm: VRM, name: string): BlendShapeValue {
    if (!vrm.expressionManager) return 0;
    const value = vrm.expressionManager.getValue(name);
    return value !== null ? value : 0;
  }

  /**
   * Set blend shape value
   */
  public static setBlendShapeValue(vrm: VRM, name: string, value: BlendShapeValue): void {
    if (!vrm.expressionManager) return;
    vrm.expressionManager.setValue(name, Math.max(0, Math.min(1, value)));
  }

  /**
   * Get all blend shape values
   */
  public static getAllBlendShapeValues(vrm: VRM): BlendShapeMap {
    if (!vrm.expressionManager) return {};
    
    const result: BlendShapeMap = {};
    const expressionNames = Object.keys(vrm.expressionManager.expressions);
    
    expressionNames.forEach((name) => {
      const value = vrm.expressionManager!.getValue(name);
      result[name] = value !== null ? value : 0;
    });
    
    return result;
  }

  /**
   * Set multiple blend shape values
   */
  public static setBlendShapeValues(vrm: VRM, blendShapes: BlendShapeMap): void {
    if (!vrm.expressionManager) return;
    
    Object.entries(blendShapes).forEach(([name, value]) => {
      vrm.expressionManager!.setValue(name, Math.max(0, Math.min(1, value)));
    });
  }

  /**
   * Reset all blend shapes to neutral
   */
  public static resetBlendShapes(vrm: VRM): void {
    if (!vrm.expressionManager) return;
    
    const expressionNames = Object.keys(vrm.expressionManager.expressions);
    expressionNames.forEach((name) => {
      vrm.expressionManager!.setValue(name, 0);
    });
  }

  /**
   * Get bone position
   */
  public static getBonePosition(vrm: VRM, boneName: VRMHumanoidBoneName): THREE.Vector3 | null {
    if (!vrm.humanoid) return null;
    
    const bone = vrm.humanoid.getNormalizedBoneNode(boneName);
    if (!bone) return null;
    
    return bone.position.clone();
  }

  /**
   * Set bone position
   */
  public static setBonePosition(vrm: VRM, boneName: VRMHumanoidBoneName, position: THREE.Vector3): void {
    if (!vrm.humanoid) return;
    
    const bone = vrm.humanoid.getNormalizedBoneNode(boneName);
    if (!bone) return;
    
    bone.position.copy(position);
  }

  /**
   * Get bone rotation
   */
  public static getBoneRotation(vrm: VRM, boneName: VRMHumanoidBoneName): THREE.Quaternion | null {
    if (!vrm.humanoid) return null;
    
    const bone = vrm.humanoid.getNormalizedBoneNode(boneName);
    if (!bone) return null;
    
    return bone.quaternion.clone();
  }

  /**
   * Set bone rotation
   */
  public static setBoneRotation(vrm: VRM, boneName: VRMHumanoidBoneName, rotation: THREE.Quaternion): void {
    if (!vrm.humanoid) return;
    
    const bone = vrm.humanoid.getNormalizedBoneNode(boneName);
    if (!bone) return;
    
    bone.quaternion.copy(rotation);
  }

  /**
   * Get bone transform (position, rotation, scale)
   */
  public static getBoneTransform(vrm: VRM, boneName: VRMHumanoidBoneName): BoneTransform | null {
    if (!vrm.humanoid) return null;
    
    const bone = vrm.humanoid.getNormalizedBoneNode(boneName);
    if (!bone) return null;
    
    return {
      position: bone.position.clone(),
      rotation: bone.quaternion.clone(),
      scale: bone.scale.clone(),
    };
  }

  /**
   * Set bone transform
   */
  public static setBoneTransform(vrm: VRM, boneName: VRMHumanoidBoneName, transform: BoneTransform): void {
    if (!vrm.humanoid) return;
    
    const bone = vrm.humanoid.getNormalizedBoneNode(boneName);
    if (!bone) return;
    
    bone.position.copy(transform.position);
    bone.quaternion.copy(transform.rotation);
    bone.scale.copy(transform.scale);
  }

  /**
   * Reset bone to default pose
   */
  public static resetBonePose(vrm: VRM, boneName: VRMHumanoidBoneName): void {
    if (!vrm.humanoid) return;
    
    const bone = vrm.humanoid.getNormalizedBoneNode(boneName);
    if (!bone) return;
    
    bone.position.set(0, 0, 0);
    bone.quaternion.set(0, 0, 0, 1);
    bone.scale.set(1, 1, 1);
  }

  /**
   * Reset all bones to default pose
   */
  public static resetAllBonePoses(vrm: VRM): void {
    if (!vrm.humanoid) return;
    
    const boneNames = [
      'hips', 'spine', 'chest', 'upperChest', 'neck', 'head',
      'leftShoulder', 'leftUpperArm', 'leftLowerArm', 'leftHand',
      'rightShoulder', 'rightUpperArm', 'rightLowerArm', 'rightHand',
      'leftUpperLeg', 'leftLowerLeg', 'leftFoot', 'leftToes',
      'rightUpperLeg', 'rightLowerLeg', 'rightFoot', 'rightToes',
      'leftEye', 'rightEye',
    ] as VRMHumanoidBoneName[];
    
    boneNames.forEach((boneName) => {
      this.resetBonePose(vrm, boneName);
    });
  }

  /**
   * Get available blend shape names
   */
  public static getAvailableBlendShapes(vrm: VRM): string[] {
    if (!vrm.expressionManager) return [];
    
    return Object.keys(vrm.expressionManager.expressions);
  }

  /**
   * Check if blend shape is available
   */
  public static hasBlendShape(vrm: VRM, name: string): boolean {
    if (!vrm.expressionManager) return false;
    
    return name in vrm.expressionManager.expressions;
  }

  /**
   * Get available bone names
   */
  public static getAvailableBones(vrm: VRM): VRMHumanoidBoneName[] {
    if (!vrm.humanoid) return [];
    
    const boneNames: VRMHumanoidBoneName[] = [];
    const allBones = [
      'hips', 'spine', 'chest', 'upperChest', 'neck', 'head',
      'leftShoulder', 'leftUpperArm', 'leftLowerArm', 'leftHand',
      'rightShoulder', 'rightUpperArm', 'rightLowerArm', 'rightHand',
      'leftUpperLeg', 'leftLowerLeg', 'leftFoot', 'leftToes',
      'rightUpperLeg', 'rightLowerLeg', 'rightFoot', 'rightToes',
      'leftEye', 'rightEye',
    ] as VRMHumanoidBoneName[];
    
    allBones.forEach((boneName) => {
      const bone = vrm.humanoid!.getNormalizedBoneNode(boneName);
      if (bone) {
        boneNames.push(boneName);
      }
    });
    
    return boneNames;
  }

  /**
   * Check if bone is available
   */
  public static hasBone(vrm: VRM, boneName: VRMHumanoidBoneName): boolean {
    if (!vrm.humanoid) return false;
    
    const bone = vrm.humanoid.getNormalizedBoneNode(boneName);
    return bone !== null;
  }

  /**
   * Validate VRM structure
   */
  public static validateVRM(vrm: VRM): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Check humanoid
    if (!vrm.humanoid) {
      errors.push('VRM does not have humanoid');
    }
    
    // Check expression manager
    if (!vrm.expressionManager) {
      errors.push('VRM does not have expression manager');
    }
    
    // Check meta
    if (!vrm.meta) {
      errors.push('VRM does not have metadata');
    }
    
    // Check required bones
    const requiredBones = ['hips', 'spine', 'head'] as VRMHumanoidBoneName[];
    requiredBones.forEach((boneName) => {
      if (!this.hasBone(vrm, boneName)) {
        errors.push(`VRM is missing required bone: ${boneName}`);
      }
    });
    
    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get VRM bounding box
   */
  public static getBoundingBox(vrm: VRM): THREE.Box3 | null {
    if (!vrm.scene) return null;
    
    const box = new THREE.Box3();
    box.setFromObject(vrm.scene);
    
    return box;
  }

  /**
   * Get VRM size (height, width, depth)
   */
  public static getSize(vrm: VRM): { height: number; width: number; depth: number } | null {
    const box = this.getBoundingBox(vrm);
    if (!box) return null;
    
    const size = new THREE.Vector3();
    box.getSize(size);
    
    return {
      height: size.y,
      width: size.x,
      depth: size.z,
    };
  }

  /**
   * Center VRM at origin
   */
  public static centerAtOrigin(vrm: VRM): void {
    if (!vrm.scene) return;
    
    const box = this.getBoundingBox(vrm);
    if (!box) return;
    
    const center = new THREE.Vector3();
    box.getCenter(center);
    
    // Move scene so center is at origin
    vrm.scene.position.sub(center);
  }

  /**
   * Scale VRM to target height
   */
  public static scaleToHeight(vrm: VRM, targetHeight: number): void {
    const size = this.getSize(vrm);
    if (!size || size.height === 0) return;
    
    const scale = targetHeight / size.height;
    vrm.scene.scale.setScalar(scale);
  }

  /**
   * Get VRM skeleton hierarchy
   */
  public static getSkeletonHierarchy(vrm: VRM): any[] {
    if (!vrm.humanoid) return [];
    
    const hierarchy: any[] = [];
    
    const addBone = (boneName: VRMHumanoidBoneName, depth: number = 0) => {
      const bone = vrm.humanoid!.getNormalizedBoneNode(boneName);
      if (!bone) return;
      
      hierarchy.push({
        name: boneName,
        depth,
        position: bone.position.clone(),
        rotation: bone.quaternion.clone(),
      });
      
      // Add children (simplified)
      const children: VRMHumanoidBoneName[] = [];
      
      if (boneName === 'hips') {
        children.push('spine', 'leftUpperLeg', 'rightUpperLeg');
      } else if (boneName === 'spine') {
        children.push('chest');
      } else if (boneName === 'chest') {
        children.push('upperChest', 'leftShoulder', 'rightShoulder');
      } else if (boneName === 'upperChest') {
        children.push('neck');
      } else if (boneName === 'neck') {
        children.push('head');
      }
      
      children.forEach((childName) => {
        addBone(childName, depth + 1);
      });
    };
    
    addBone('hips');
    
    return hierarchy;
  }
}
