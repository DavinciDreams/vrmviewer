/**
 * VRoid VRM bone names and humanoid bone mappings
 */

/**
 * VRoid Studio specific bone names
 */
export const VRoidBoneNames = {
  // Head
  Head: 'Head',
  Neck: 'Neck',
  
  // Eyes
  LeftEye: 'LeftEye',
  RightEye: 'RightEye',
  
  // Spine
  Spine: 'Spine',
  Chest: 'Chest',
  UpperChest: 'UpperChest',
  
  // Shoulders
  LeftShoulder: 'LeftShoulder',
  RightShoulder: 'RightShoulder',
  
  // Arms
  LeftUpperArm: 'LeftUpperArm',
  LeftLowerArm: 'LeftLowerArm',
  LeftHand: 'LeftHand',
  RightUpperArm: 'RightUpperArm',
  RightLowerArm: 'RightLowerArm',
  RightHand: 'RightHand',
  
  // Legs
  LeftUpperLeg: 'LeftUpperLeg',
  LeftLowerLeg: 'LeftLowerLeg',
  LeftFoot: 'LeftFoot',
  RightUpperLeg: 'RightUpperLeg',
  RightLowerLeg: 'RightLowerLeg',
  RightFoot: 'RightFoot',
  
  // Toes
  LeftToes: 'LeftToes',
  RightToes: 'RightToes',
  
  // Fingers
  LeftThumb: 'LeftThumb',
  LeftIndex: 'LeftIndex',
  LeftMiddle: 'LeftMiddle',
  LeftRing: 'LeftRing',
  LeftLittle: 'LeftLittle',
  RightThumb: 'RightThumb',
  RightIndex: 'RightIndex',
  RightMiddle: 'RightMiddle',
  RightRing: 'RightRing',
  RightLittle: 'RightLittle',
} as const;

/**
 * Standard VRM humanoid bone names (VRM 1.0 specification)
 */
export const VRMHumanoidBoneNames = {
  hips: 'hips',
  spine: 'spine',
  chest: 'chest',
  upperChest: 'upperChest',
  neck: 'neck',
  head: 'head',
  
  leftShoulder: 'leftShoulder',
  leftUpperArm: 'leftUpperArm',
  leftLowerArm: 'leftLowerArm',
  leftHand: 'leftHand',
  
  rightShoulder: 'rightShoulder',
  rightUpperArm: 'rightUpperArm',
  rightLowerArm: 'rightLowerArm',
  rightHand: 'rightHand',
  
  leftUpperLeg: 'leftUpperLeg',
  leftLowerLeg: 'leftLowerLeg',
  leftFoot: 'leftFoot',
  leftToes: 'leftToes',
  
  rightUpperLeg: 'rightUpperLeg',
  rightLowerLeg: 'rightLowerLeg',
  rightFoot: 'rightFoot',
  rightToes: 'rightToes',
  
  leftEye: 'leftEye',
  rightEye: 'rightEye',
  
  leftThumbMetacarpal: 'leftThumbMetacarpal',
  leftThumbProximal: 'leftThumbProximal',
  leftThumbDistal: 'leftThumbDistal',
  leftIndexProximal: 'leftIndexProximal',
  leftIndexIntermediate: 'leftIndexIntermediate',
  leftIndexDistal: 'leftIndexDistal',
  leftMiddleProximal: 'leftMiddleProximal',
  leftMiddleIntermediate: 'leftMiddleIntermediate',
  leftMiddleDistal: 'leftMiddleDistal',
  leftRingProximal: 'leftRingProximal',
  leftRingIntermediate: 'leftRingIntermediate',
  leftRingDistal: 'leftRingDistal',
  leftLittleProximal: 'leftLittleProximal',
  leftLittleIntermediate: 'leftLittleIntermediate',
  leftLittleDistal: 'leftLittleDistal',
  
  rightThumbMetacarpal: 'rightThumbMetacarpal',
  rightThumbProximal: 'rightThumbProximal',
  rightThumbDistal: 'rightThumbDistal',
  rightIndexProximal: 'rightIndexProximal',
  rightIndexIntermediate: 'rightIndexIntermediate',
  rightIndexDistal: 'rightIndexDistal',
  rightMiddleProximal: 'rightMiddleProximal',
  rightMiddleIntermediate: 'rightMiddleIntermediate',
  rightMiddleDistal: 'rightMiddleDistal',
  rightRingProximal: 'rightRingProximal',
  rightRingIntermediate: 'rightRingIntermediate',
  rightRingDistal: 'rightRingDistal',
  rightLittleProximal: 'rightLittleProximal',
  rightLittleIntermediate: 'rightLittleIntermediate',
  rightLittleDistal: 'rightLittleDistal',
} as const;

/**
 * Bone hierarchy for animation purposes
 */
export const BoneHierarchy = {
  root: ['hips'],
  hips: ['spine', 'leftUpperLeg', 'rightUpperLeg'],
  spine: ['chest'],
  chest: ['upperChest', 'leftShoulder', 'rightShoulder'],
  upperChest: ['neck'],
  neck: ['head'],
  head: ['leftEye', 'rightEye'],
  
  leftShoulder: ['leftUpperArm'],
  leftUpperArm: ['leftLowerArm'],
  leftLowerArm: ['leftHand'],
  leftHand: ['leftThumbMetacarpal', 'leftIndexProximal', 'leftMiddleProximal', 'leftRingProximal', 'leftLittleProximal'],
  
  rightShoulder: ['rightUpperArm'],
  rightUpperArm: ['rightLowerArm'],
  rightLowerArm: ['rightHand'],
  rightHand: ['rightThumbMetacarpal', 'rightIndexProximal', 'rightMiddleProximal', 'rightRingProximal', 'rightLittleProximal'],
  
  leftUpperLeg: ['leftLowerLeg'],
  leftLowerLeg: ['leftFoot'],
  leftFoot: ['leftToes'],
  
  rightUpperLeg: ['rightLowerLeg'],
  rightLowerLeg: ['rightFoot'],
  rightFoot: ['rightToes'],
} as const;

/**
 * Bones affected by breathing animation
 */
export const BreathingBones = [
  'spine',
  'chest',
  'upperChest',
  'leftShoulder',
  'rightShoulder',
] as const;

/**
 * Bones affected by head movement
 */
export const HeadMovementBones = [
  'neck',
  'head',
  'leftEye',
  'rightEye',
] as const;

/**
 * Type definitions
 */
export type VRoidBoneName = typeof VRoidBoneNames[keyof typeof VRoidBoneNames];
export type VRMHumanoidBoneName = typeof VRMHumanoidBoneNames[keyof typeof VRMHumanoidBoneNames];
