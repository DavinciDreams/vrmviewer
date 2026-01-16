/**
 * VRM Model Types
 * Defines types for VRM models, metadata, and related structures
 */

import * as THREE from 'three';
import { VRM as VRMType } from '@pixiv/three-vrm';

/**
 * VRM Version
 */
export type VRMVersion = '0.0' | '1.0';

/**
 * VRM Metadata
 */
export interface VRMMetadata {
  title: string;
  version: string;
  author: string;
  contactInformation?: string;
  reference?: string;
  thumbnail?: string;
  license?: VRMLicense;
  allowedUserName?: string;
  violentUsageName?: string;
  sexualUsageName?: string;
  commercialUsageName?: string;
  politicalOrReligiousUsageName?: string;
  antisocialOrHateUsageName?: string;
  creditNotation?: string;
  allowRedistribution?: string;
  modification?: string;
  otherLicenseUrl?: string;
}

/**
 * VRM License
 */
export interface VRMLicense {
  type?: string;
  url?: string;
  text?: string;
}

/**
 * VRM Expression
 */
export interface VRMExpression {
  name: string;
  preset?: VRMExpressionPreset;
  overrideBlink?: string;
  overrideLookAt?: string;
  overrideMouth?: string;
  isBinary?: boolean;
  morphTargetBinds?: VRMMorphTargetBind[];
  materialColorBinds?: VRMMaterialColorBind[];
  textureTransformBinds?: VRMTextureTransformBind[];
}

/**
 * VRM Expression Preset
 */
export type VRMExpressionPreset =
  | 'aa'
  | 'ih'
  | 'ou'
  | 'ee'
  | 'oh'
  | 'blink'
  | 'blinkLeft'
  | 'blinkRight'
  | 'lookLeft'
  | 'lookRight'
  | 'lookUp'
  | 'lookDown'
  | 'neutral'
  | 'surprised'
  | 'angry'
  | 'sad'
  | 'happy'
  | 'relaxed'
  | 'unknown';

/**
 * VRM Morph Target Bind
 */
export interface VRMMorphTargetBind {
  mesh: THREE.Mesh;
  index: number;
  weight: number;
}

/**
 * VRM Material Color Bind
 */
export interface VRMMaterialColorBind {
  material: THREE.Material;
  type: 'color' | 'emission' | 'outlineColor';
  targetValue: THREE.Color;
}

/**
 * VRM Texture Transform Bind
 */
export interface VRMTextureTransformBind {
  material: THREE.Material;
  offset: THREE.Vector2;
  scale: THREE.Vector2;
  rotation: number;
}

/**
 * VRM First Person
 */
export interface VRMFirstPerson {
  meshAnnotations: VRMMeshAnnotation[];
  lookAt?: VRMLookAt;
}

/**
 * VRM Mesh Annotation
 */
export interface VRMMeshAnnotation {
  mesh: THREE.Mesh;
  firstPersonFlag: 'auto' | 'both' | 'thirdPersonOnly' | 'firstPersonOnly';
}

/**
 * VRM Look At
 */
export interface VRMLookAt {
  type: 'bone' | 'blendShape';
  offsetFromHeadBone?: THREE.Vector3;
  lookAtHorizontalInner?: THREE.Object3D;
  lookAtHorizontalOuter?: THREE.Object3D;
  lookAtVerticalDown?: THREE.Object3D;
  lookAtVerticalUp?: THREE.Object3D;
}

/**
 * VRM Humanoid
 */
export interface VRMHumanoid {
  humanBones: VRMHumanBone[];
  armStretch?: number;
  legStretch?: number;
  upperArmTwist?: number;
  lowerArmTwist?: number;
  upperLegTwist?: number;
  lowerLegTwist?: number;
  feetSpacing?: number;
  hasTranslationDoF?: boolean;
}

/**
 * VRM Human Bone
 */
export interface VRMHumanBone {
  bone: VRMHumanBoneName;
  node?: THREE.Object3D;
  axisLength?: number;
  useDefaultValues?: boolean;
  min?: THREE.Vector3;
  max?: THREE.Vector3;
  center?: THREE.Vector3;
}

/**
 * VRM Human Bone Name
 */
export type VRMHumanBoneName =
  | 'hips'
  | 'spine'
  | 'chest'
  | 'upperChest'
  | 'neck'
  | 'head'
  | 'leftEye'
  | 'rightEye'
  | 'jaw'
  | 'leftUpperLeg'
  | 'leftLowerLeg'
  | 'leftFoot'
  | 'leftToes'
  | 'rightUpperLeg'
  | 'rightLowerLeg'
  | 'rightFoot'
  | 'rightToes'
  | 'leftShoulder'
  | 'leftUpperArm'
  | 'leftLowerArm'
  | 'leftHand'
  | 'leftThumbMetacarpal'
  | 'leftThumbProximal'
  | 'leftThumbDistal'
  | 'leftIndexProximal'
  | 'leftIndexIntermediate'
  | 'leftIndexDistal'
  | 'leftMiddleProximal'
  | 'leftMiddleIntermediate'
  | 'leftMiddleDistal'
  | 'leftRingProximal'
  | 'leftRingIntermediate'
  | 'leftRingDistal'
  | 'leftLittleProximal'
  | 'leftLittleIntermediate'
  | 'leftLittleDistal'
  | 'rightShoulder'
  | 'rightUpperArm'
  | 'rightLowerArm'
  | 'rightHand'
  | 'rightThumbMetacarpal'
  | 'rightThumbProximal'
  | 'rightThumbDistal'
  | 'rightIndexProximal'
  | 'rightIndexIntermediate'
  | 'rightIndexDistal'
  | 'rightMiddleProximal'
  | 'rightMiddleIntermediate'
  | 'rightMiddleDistal'
  | 'rightRingProximal'
  | 'rightRingIntermediate'
  | 'rightRingDistal'
  | 'rightLittleProximal'
  | 'rightLittleIntermediate'
  | 'rightLittleDistal';

/**
 * VRM Model
 */
export interface VRMModel {
  vrm: VRMType;
  metadata: VRMMetadata;
  expressions: Map<string, unknown>;
  humanoid: VRMHumanoid;
  firstPerson: unknown;
  scene: THREE.Group;
  skeleton: THREE.Skeleton;
}

/**
 * Loader Result
 */
export interface LoaderResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: LoaderError;
  warnings?: LoaderWarning[];
}

/**
 * Loader Error
 */
export interface LoaderError {
  type: LoaderErrorType;
  message: string;
  details?: unknown;
  stack?: string;
}

/**
 * Loader Error Type
 */
export type LoaderErrorType =
  | 'FILE_NOT_FOUND'
  | 'INVALID_FORMAT'
  | 'PARSE_ERROR'
  | 'VERSION_UNSUPPORTED'
  | 'RESOURCE_MISSING'
  | 'CORRUPTED_DATA'
  | 'NETWORK_ERROR'
  | 'UNKNOWN';

/**
 * Loader Warning
 */
export interface LoaderWarning {
  type: LoaderWarningType;
  message: string;
  details?: unknown;
}

/**
 * Loader Warning Type
 */
export type LoaderWarningType =
  | 'MISSING_TEXTURE'
  | 'UNSUPPORTED_FEATURE'
  | 'DEPRECATED_FORMAT'
  | 'PARTIAL_LOAD'
  | 'PERFORMANCE_WARNING';

/**
 * Loading Progress
 */
export interface LoadingProgress {
  loaded: number;
  total: number;
  percentage: number;
  stage: LoadingStage;
}

/**
 * Loading Stage
 */
export type LoadingStage =
  | 'INITIALIZING'
  | 'DOWNLOADING'
  | 'PARSING'
  | 'PROCESSING'
  | 'FINALIZING'
  | 'COMPLETE';

/**
 * Model File Info
 */
export interface ModelFileInfo {
  name: string;
  size: number;
  type: ModelFileType;
  format: ModelFormat;
  lastModified: Date;
}

/**
 * Model File Type
 */
export type ModelFileType = 'model' | 'animation';

/**
 * Model Format
 */
export type ModelFormat = 'vrm' | 'gltf' | 'glb' | 'fbx' | 'bvh' | 'vrma';

/**
 * Model Load Options
 */
export interface ModelLoadOptions {
  url?: string;
  file?: File;
  arrayBuffer?: ArrayBuffer;
  progressCallback?: (progress: LoadingProgress) => void;
  strictMode?: boolean;
  generateMipmaps?: boolean;
  textureEncoding?: THREE.ColorSpace;
}
