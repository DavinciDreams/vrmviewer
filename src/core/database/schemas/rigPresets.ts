/**
 * Rigging Presets
 * Predefined skeleton configurations for different asset types
 * Supports automatic bone mapping and retargeting setup
 */

import { SkeletonType, AssetType } from './databaseSchema';
import * as THREE from 'three';

/**
 * Bone Mapping
 * Maps source bone names to target bone names
 */
export interface BoneMapping {
  source: string;
  target: string;
  required: boolean;
}

/**
 * Rig Preset
 * Defines a skeleton rig configuration
 */
export interface RigPreset {
  id: string;
  name: string;
  displayName: string;
  description: string;
  skeletonType: SkeletonType;
  assetType: AssetType[];
  // Bone hierarchy definition
  boneNames: string[];
  boneHierarchy: BoneHierarchy;
  // Required bones for this preset
  requiredBones: string[];
  optionalBones: string[];
  // Default bone mappings
  defaultMappings: BoneMapping[];
  // IK chains setup
  ikChains?: IKChain[];
  // Animation constraints
  constraints?: AnimationConstraint[];
}

/**
 * Bone Hierarchy
 * Defines parent-child relationships
 */
export interface BoneHierarchy {
  [boneName: string]: {
    parent?: string;
    children: string[];
    side?: 'left' | 'center' | 'right';
  };
}

/**
 * IK Chain Definition
 */
export interface IKChain {
  name: string;
  type: 'limb' | 'spine' | 'tail' | 'wing';
  bones: string[];
  target?: string;
  poleTarget?: string;
}

/**
 * Animation Constraint
 */
export interface AnimationConstraint {
  name: string;
  type: 'ik' | 'limit' | 'drive' | 'track';
  bone: string;
  target?: string;
  min?: THREE.Vector3;
  max?: THREE.Vector3;
}

/**
 * Common bone name patterns
 * Used for auto-detection
 */
export const BONE_PATTERNS = {
  // Humanoid bones
  HIPS: ['hips', 'pelvis', 'root', 'hip', 'centerhip'],
  SPINE: ['spine', 'spine01', 'spine1', 'upper_body'],
  CHEST: ['chest', 'spine02', 'spine2', 'torso'],
  NECK: ['neck', 'neck01', 'neck1'],
  HEAD: ['head', 'head_end'],

  LEFT_SHOULDER: ['l_shoulder', 'left_shoulder', 'shoulder_l', 'clavicle_l'],
  RIGHT_SHOULDER: ['r_shoulder', 'right_shoulder', 'shoulder_r', 'clavicle_r'],
  LEFT_ARM: ['l_upperarm', 'left_upperarm', 'arm_l', 'upperarm_l'],
  RIGHT_ARM: ['r_upperarm', 'right_upperarm', 'arm_r', 'upperarm_r'],
  LEFT_FOREARM: ['l_forearm', 'left_forearm', 'forearm_l', 'lowerarm_l'],
  RIGHT_FOREARM: ['r_forearm', 'right_forearm', 'forearm_r', 'lowerarm_r'],
  LEFT_HAND: ['l_hand', 'left_hand', 'hand_l', 'wrist_l'],
  RIGHT_HAND: ['r_hand', 'right_hand', 'hand_r', 'wrist_r'],

  LEFT_UPLEG: ['l_upleg', 'left_upleg', 'thigh_l', 'upperleg_l'],
  RIGHT_UPLEG: ['r_upleg', 'right_upleg', 'thigh_r', 'upperleg_r'],
  LEFT_LEG: ['l_leg', 'left_leg', 'calf_l', 'lowerleg_l'],
  RIGHT_LEG: ['r_leg', 'right_leg', 'calf_r', 'lowerleg_r'],
  LEFT_FOOT: ['l_foot', 'left_foot', 'foot_l', 'ankle_l'],
  RIGHT_FOOT: ['r_foot', 'right_foot', 'foot_r', 'ankle_r'],

  // Quadruped bones
  QUAD_SPINE: ['spine', 'back', 'spine01'],
  QUAD_CHEST: ['chest', 'ribcage', 'spine02'],
  QUAD_NECK: ['neck', 'neck01'],
  QUAD_HEAD: ['head', 'skull'],

  FRONT_LEFT_LEG: ['lf_leg', 'front_left_leg', 'foreleg_l', 'leg_lf'],
  FRONT_RIGHT_LEG: ['rf_leg', 'front_right_leg', 'foreleg_r', 'leg_rf'],
  BACK_LEFT_LEG: ['lb_leg', 'back_left_leg', 'hindleg_l', 'leg_lb'],
  BACK_RIGHT_LEG: ['rb_leg', 'back_right_leg', 'hindleg_r', 'leg_rb'],

  FRONT_LEFT_FOOT: ['lf_foot', 'front_left_foot', 'paw_lf'],
  FRONT_RIGHT_FOOT: ['rf_foot', 'front_right_foot', 'paw_rf'],
  BACK_LEFT_FOOT: ['lb_foot', 'back_left_foot', 'paw_lb'],
  BACK_RIGHT_FOOT: ['rb_foot', 'back_right_foot', 'paw_rb'],

  // Tail
  TAIL: ['tail', 'tail01', 'tail1'],
  TAIL_BASE: ['tail_base', 'tail_root'],
  TAIL_TIP: ['tail_tip', 'tail_end'],

  // Wings
  LEFT_WING_ROOT: ['l_wing_root', 'left_wing_root', 'wing_l_root'],
  RIGHT_WING_ROOT: ['r_wing_root', 'right_wing_root', 'wing_r_root'],
};

/**
 * Humanoid Rig Preset
 * Standard VRM/Unity humanoid rig
 */
export const HUMANOID_PRESET: RigPreset = {
  id: 'humanoid_vrm',
  name: 'humanoid_vrm',
  displayName: 'Humanoid (VRM/Unity)',
  description: 'Standard humanoid rig compatible with VRM and Unity',
  skeletonType: SkeletonType.HUMANOID,
  assetType: [AssetType.CHARACTER],
  boneNames: [
    'hips',
    'spine',
    'chest',
    'neck',
    'head',
    'leftShoulder',
    'rightShoulder',
    'leftUpperArm',
    'rightUpperArm',
    'leftLowerArm',
    'rightLowerArm',
    'leftHand',
    'rightHand',
    'leftUpperLeg',
    'rightUpperLeg',
    'leftLowerLeg',
    'rightLowerLeg',
    'leftFoot',
    'rightFoot',
  ],
  boneHierarchy: {
    hips: { children: ['spine', 'leftUpperLeg', 'rightUpperLeg'] },
    spine: { parent: 'hips', children: ['chest'], side: 'center' },
    chest: { parent: 'spine', children: ['neck', 'leftShoulder', 'rightShoulder'], side: 'center' },
    neck: { parent: 'chest', children: ['head'], side: 'center' },
    head: { parent: 'neck', children: [], side: 'center' },
    leftShoulder: { parent: 'chest', children: ['leftUpperArm'], side: 'left' },
    rightShoulder: { parent: 'chest', children: ['rightUpperArm'], side: 'right' },
    leftUpperArm: { parent: 'leftShoulder', children: ['leftLowerArm'], side: 'left' },
    rightUpperArm: { parent: 'rightShoulder', children: ['rightLowerArm'], side: 'right' },
    leftLowerArm: { parent: 'leftUpperArm', children: ['leftHand'], side: 'left' },
    rightLowerArm: { parent: 'rightUpperArm', children: ['rightHand'], side: 'right' },
    leftHand: { parent: 'leftLowerArm', children: [], side: 'left' },
    rightHand: { parent: 'rightLowerArm', children: [], side: 'right' },
    leftUpperLeg: { parent: 'hips', children: ['leftLowerLeg'], side: 'left' },
    rightUpperLeg: { parent: 'hips', children: ['rightLowerLeg'], side: 'right' },
    leftLowerLeg: { parent: 'leftUpperLeg', children: ['leftFoot'], side: 'left' },
    rightLowerLeg: { parent: 'rightUpperLeg', children: ['rightFoot'], side: 'right' },
    leftFoot: { parent: 'leftLowerLeg', children: [], side: 'left' },
    rightFoot: { parent: 'rightLowerLeg', children: [], side: 'right' },
  },
  requiredBones: ['hips', 'spine', 'head'],
  optionalBones: ['chest', 'neck', 'leftShoulder', 'rightShoulder'],
  defaultMappings: [
    { source: 'hip', target: 'hips', required: true },
    { source: 'pelvis', target: 'hips', required: true },
    { source: 'spine', target: 'spine', required: true },
    { source: 'head', target: 'head', required: true },
    { source: 'l_shoulder', target: 'leftShoulder', required: false },
    { source: 'r_shoulder', target: 'rightShoulder', required: false },
  ],
  ikChains: [
    {
      name: 'left_leg_ik',
      type: 'limb',
      bones: ['leftUpperLeg', 'leftLowerLeg', 'leftFoot'],
      target: 'leftFoot',
    },
    {
      name: 'right_leg_ik',
      type: 'limb',
      bones: ['rightUpperLeg', 'rightLowerLeg', 'rightFoot'],
      target: 'rightFoot',
    },
    {
      name: 'left_arm_ik',
      type: 'limb',
      bones: ['leftUpperArm', 'leftLowerArm', 'leftHand'],
      target: 'leftHand',
    },
    {
      name: 'right_arm_ik',
      type: 'limb',
      bones: ['rightUpperArm', 'rightLowerArm', 'rightHand'],
      target: 'rightHand',
    },
  ],
};

/**
 * Quadruped Rig Preset
 * Four-legged creature rig
 */
export const QUADRUPED_PRESET: RigPreset = {
  id: 'quadruped_generic',
  name: 'quadruped_generic',
  displayName: 'Quadruped (Generic)',
  description: 'Generic four-legged creature rig',
  skeletonType: SkeletonType.QUADRUPED,
  assetType: [AssetType.CREATURE],
  boneNames: [
    'root',
    'spine',
    'chest',
    'neck',
    'head',
    'tail',
    'frontLeftLeg',
    'frontRightLeg',
    'backLeftLeg',
    'backRightLeg',
    'frontLeftFoot',
    'frontRightFoot',
    'backLeftFoot',
    'backRightFoot',
  ],
  boneHierarchy: {
    root: { children: ['spine', 'tail'] },
    spine: { parent: 'root', children: ['chest', 'backLeftLeg', 'backRightLeg'] },
    chest: { parent: 'spine', children: ['neck', 'frontLeftLeg', 'frontRightLeg'] },
    neck: { parent: 'chest', children: ['head'] },
    head: { parent: 'neck', children: [] },
    tail: { parent: 'root', children: [] },
    frontLeftLeg: { parent: 'chest', children: ['frontLeftFoot'] },
    frontRightLeg: { parent: 'chest', children: ['frontRightFoot'] },
    backLeftLeg: { parent: 'spine', children: ['backLeftFoot'] },
    backRightLeg: { parent: 'spine', children: ['backRightFoot'] },
    frontLeftFoot: { parent: 'frontLeftLeg', children: [] },
    frontRightFoot: { parent: 'frontRightLeg', children: [] },
    backLeftFoot: { parent: 'backLeftLeg', children: [] },
    backRightFoot: { parent: 'backRightLeg', children: [] },
  },
  requiredBones: ['root', 'spine'],
  optionalBones: ['chest', 'neck', 'head', 'tail'],
  defaultMappings: [
    { source: 'hips', target: 'root', required: true },
    { source: 'spine', target: 'spine', required: true },
  ],
  ikChains: [
    {
      name: 'front_left_ik',
      type: 'limb',
      bones: ['frontLeftLeg', 'frontLeftFoot'],
      target: 'frontLeftFoot',
    },
    {
      name: 'front_right_ik',
      type: 'limb',
      bones: ['frontRightLeg', 'frontRightFoot'],
      target: 'frontRightFoot',
    },
    {
      name: 'back_left_ik',
      type: 'limb',
      bones: ['backLeftLeg', 'backLeftFoot'],
      target: 'backLeftFoot',
    },
    {
      name: 'back_right_ik',
      type: 'limb',
      bones: ['backRightLeg', 'backRightFoot'],
      target: 'backRightFoot',
    },
  ],
};

/**
 * Biped Rig Preset
 * Two-legged creature (not humanoid)
 */
export const BIPED_PRESET: RigPreset = {
  id: 'biped_generic',
  name: 'biped_generic',
  displayName: 'Biped (Generic)',
  description: 'Generic two-legged creature rig',
  skeletonType: SkeletonType.BIPED,
  assetType: [AssetType.CREATURE],
  boneNames: [
    'root',
    'spine',
    'chest',
    'neck',
    'head',
    'tail',
    'leftLeg',
    'rightLeg',
    'leftFoot',
    'rightFoot',
  ],
  boneHierarchy: {
    root: { children: ['spine', 'leftLeg', 'rightLeg', 'tail'] },
    spine: { parent: 'root', children: ['chest'] },
    chest: { parent: 'spine', children: ['neck'] },
    neck: { parent: 'chest', children: ['head'] },
    head: { parent: 'neck', children: [] },
    tail: { parent: 'root', children: [] },
    leftLeg: { parent: 'root', children: ['leftFoot'] },
    rightLeg: { parent: 'root', children: ['rightFoot'] },
    leftFoot: { parent: 'leftLeg', children: [] },
    rightFoot: { parent: 'rightLeg', children: [] },
  },
  requiredBones: ['root', 'spine'],
  optionalBones: ['chest', 'neck', 'head', 'tail'],
  defaultMappings: [
    { source: 'hips', target: 'root', required: true },
    { source: 'spine', target: 'spine', required: true },
  ],
  ikChains: [
    {
      name: 'left_leg_ik',
      type: 'limb',
      bones: ['leftLeg', 'leftFoot'],
      target: 'leftFoot',
    },
    {
      name: 'right_leg_ik',
      type: 'limb',
      bones: ['rightLeg', 'rightFoot'],
      target: 'rightFoot',
    },
  ],
};

/**
 * Avian (Bird) Rig Preset
 */
export const AVIAN_PRESET: RigPreset = {
  id: 'avian_generic',
  name: 'avian_generic',
  displayName: 'Avian (Bird)',
  description: 'Bird rig with wings',
  skeletonType: SkeletonType.AVIAN,
  assetType: [AssetType.CREATURE],
  boneNames: [
    'root',
    'spine',
    'chest',
    'neck',
    'head',
    'tail',
    'leftLeg',
    'rightLeg',
    'leftWing',
    'rightWing',
  ],
  boneHierarchy: {
    root: { children: ['spine', 'leftLeg', 'rightLeg', 'tail'] },
    spine: { parent: 'root', children: ['chest'] },
    chest: { parent: 'spine', children: ['neck', 'leftWing', 'rightWing'] },
    neck: { parent: 'chest', children: ['head'] },
    head: { parent: 'neck', children: [] },
    tail: { parent: 'root', children: [] },
    leftLeg: { parent: 'root', children: [] },
    rightLeg: { parent: 'root', children: [] },
    leftWing: { parent: 'chest', children: [] },
    rightWing: { parent: 'chest', children: [] },
  },
  requiredBones: ['root', 'spine', 'chest'],
  optionalBones: ['neck', 'head', 'tail', 'leftWing', 'rightWing'],
  defaultMappings: [],
  ikChains: [
    {
      name: 'left_wing_ik',
      type: 'limb',
      bones: ['leftWing'],
      target: 'leftWing',
    },
    {
      name: 'right_wing_ik',
      type: 'limb',
      bones: ['rightWing'],
      target: 'rightWing',
    },
  ],
};

/**
 * All rig presets
 */
export const RIG_PRESETS: RigPreset[] = [
  HUMANOID_PRESET,
  QUADRUPED_PRESET,
  BIPED_PRESET,
  AVIAN_PRESET,
];

/**
 * Rig Preset Manager
 */
export class RigPresetManager {
  private presets: Map<string, RigPreset>;

  constructor() {
    this.presets = new Map();
    RIG_PRESETS.forEach((preset) => {
      this.presets.set(preset.id, preset);
    });
  }

  /**
   * Get preset by ID
   */
  getPreset(id: string): RigPreset | undefined {
    return this.presets.get(id);
  }

  /**
   * Get presets by skeleton type
   */
  getPresetsBySkeletonType(skeletonType: SkeletonType): RigPreset[] {
    return Array.from(this.presets.values()).filter(
      (p) => p.skeletonType === skeletonType
    );
  }

  /**
   * Get presets by asset type
   */
  getPresetsByAssetType(assetType: AssetType): RigPreset[] {
    return Array.from(this.presets.values()).filter((p) =>
      p.assetType.includes(assetType)
    );
  }

  /**
   * Get all presets
   */
  getAllPresets(): RigPreset[] {
    return Array.from(this.presets.values());
  }

  /**
   * Detect preset from bone names
   */
  detectPreset(boneNames: string[]): RigPreset | null {
    const boneSet = new Set(boneNames.map((n) => n.toLowerCase()));

    // Score each preset based on bone name matches
    const scores = Array.from(this.presets.values()).map((preset) => {
      let score = 0;
      let requiredMatches = 0;

      // Check required bones
      for (const requiredBone of preset.requiredBones) {
        if (boneSet.has(requiredBone.toLowerCase())) {
          requiredMatches++;
          score += 10;
        }
      }

      // Check optional bones
      for (const optionalBone of preset.optionalBones) {
        if (boneSet.has(optionalBone.toLowerCase())) {
          score += 5;
        }
      }

      // Check pattern matches
      for (const bone of boneNames) {
        const lowerBone = bone.toLowerCase();
        for (const [_key, patterns] of Object.entries(BONE_PATTERNS)) {
          if (patterns.some((p) => lowerBone.includes(p))) {
            score += 1;
          }
        }
      }

      return {
        preset,
        score,
        requiredMatches,
      };
    });

    // Filter to presets with all required bones
    const validPresets = scores.filter(
      (s) => s.requiredMatches === s.preset.requiredBones.length
    );

    if (validPresets.length === 0) {
      return null;
    }

    // Sort by score and return highest
    validPresets.sort((a, b) => b.score - a.score);
    return validPresets[0].preset;
  }

  /**
   * Create bone mapping from source to target preset
   */
  createBoneMapping(
    sourceBones: string[],
    targetPreset: RigPreset
  ): Map<string, string> {
    const mapping = new Map<string, string>();

    // Use default mappings
    for (const defaultMapping of targetPreset.defaultMappings) {
      const sourceKey = defaultMapping.source.toLowerCase();
      const targetKey = defaultMapping.target;

      // Find matching source bone
      for (const sourceBone of sourceBones) {
        const lowerSource = sourceBone.toLowerCase();
        if (lowerSource.includes(sourceKey) || sourceKey.includes(lowerSource)) {
          mapping.set(sourceBone, targetKey);
          break;
        }
      }
    }

    // Map remaining bones by pattern
    for (const sourceBone of sourceBones) {
      if (mapping.has(sourceBone)) {
        continue;
      }

      const lowerSource = sourceBone.toLowerCase();

      // Try to find matching bone name in target preset
      for (const targetBone of targetPreset.boneNames) {
        const lowerTarget = targetBone.toLowerCase();
        if (
          lowerSource.includes(lowerTarget) ||
          lowerTarget.includes(lowerSource) ||
          lowerSource.replace(/[_\s]/g, '') === lowerTarget.replace(/[_\s]/g, '')
        ) {
          mapping.set(sourceBone, targetBone);
          break;
        }
      }
    }

    return mapping;
  }
}

/**
 * Rig preset manager singleton
 */
let rigPresetManagerInstance: RigPresetManager | null = null;

/**
 * Get rig preset manager instance
 */
export function getRigPresetManager(): RigPresetManager {
  if (!rigPresetManagerInstance) {
    rigPresetManagerInstance = new RigPresetManager();
  }
  return rigPresetManagerInstance;
}
