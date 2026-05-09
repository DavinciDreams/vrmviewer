/**
 * Model Types
 * Format-agnostic type definitions for 3D models and animations
 * Replaces VRM-centric types with universal model support
 */

import * as THREE from 'three';
import { VRM as VRMType } from '@pixiv/three-vrm';

/**
 * Model Format - All supported 3D model formats
 */
export type ModelFormat =
  | 'glb'      // Binary glTF (PRIMARY FORMAT)
  | 'gltf'     // JSON-based glTF (PRIMARY FORMAT)
  | 'vrm'      // VRoid Model (humanoid-specific)
  | 'vrma'     // VRoid Animation (motion format)
  | 'fbx'      // Autodesk FBX
  | 'bvh'      // Motion capture animation
  | 'pmx'      // MikuMikuDance PMX
  | 'obj'      // Wavefront OBJ (geometry only)
  | 'vmd';     // MikuMikuDance animation

/**
 * Asset Type - Categories for different model purposes
 */
export enum AssetType {
  CHARACTER = 'character',      // Humanoid characters
  CREATURE = 'creature',        // Animals, monsters, non-humanoids
  PROP = 'prop',                // Objects, weapons, items
  VEHICLE = 'vehicle',          // Cars, planes, machines
  ENVIRONMENT = 'environment',  // Terrain, buildings, scenery
  EFFECT = 'effect',            // Particle systems, vfx
  OTHER = 'other',              // Unclassified
}

/**
 * Skeleton Type - Detected bone structure
 */
export enum SkeletonType {
  HUMANOID = 'humanoid',        // Human-like skeleton
  QUADRUPED = 'quadruped',      // Four-legged creature
  BIPED = 'biped',              // Two-legged non-human
  AVIAN = 'avian',              // Bird/winged creature
  FISH = 'fish',                // Aquatic creature
  SERPENTINE = 'serpentine',    // Snake-like
  ARTHROPOD = 'arthropod',      // Insect/spider-like
  CUSTOM = 'custom',            // User-defined rig
  NONE = 'none',                // No skeleton (static mesh)
}

/**
 * Format Capabilities - What each format supports
 */
export interface FormatCapabilities {
  supportsAnimations: boolean;     // Can contain animations
  supportsMorphTargets: boolean;   // Can have morph targets/blend shapes
  supportsMaterials: boolean;      // Has material definitions
  supportsLighting: boolean;       // Has light sources
  supportsCameras: boolean;        // Has camera definitions
  supportsSkeleton: boolean;       // Can have bone rigging
  supportsTextures: boolean;       // Can have textures
  maxBoneCount?: number;           // Maximum bones (if limited)
  compression?: string;            // Compression method (if any)
}

/**
 * Model Metadata - Generic metadata for all formats
 */
export interface ModelMetadata {
  // Core identity
  name: string;
  version: string;
  author?: string;
  title?: string;                  // Alternative to name
  description?: string;

  // Technical info
  format: ModelFormat;
  formatVersion?: string;          // Format-specific version (e.g., "1.0" for VRM)
  assetType: AssetType;

  // Skeleton info (if applicable)
  skeleton?: SkeletonMetadata;

  // Format capabilities
  capabilities?: FormatCapabilities;

  // Licensing (if provided)
  license?: {
    type?: string;
    url?: string;
    text?: string;
    allowedUserName?: string;
    violentUsageName?: string;
    sexualUsageName?: string;
    commercialUsageName?: string;
    politicalOrReligiousUsageName?: string;
    creditNotation?: string;
    allowRedistribution?: string;
    modification?: string;
  };

  // Contact info
  contactInformation?: string;
  reference?: string;
  thumbnail?: string;

  // Format-specific metadata (preserve original data)
  extras?: Record<string, unknown>;
}

/**
 * Skeleton Metadata - Bone structure information
 */
export interface SkeletonMetadata {
  type: SkeletonType;
  boneCount: number;
  hasMorphTargets: boolean;
  rigging?: string;                // 'humanoid', 'quadruped', 'custom', etc.
  boneNames?: string[];            // List of bone names
  rootBone?: string;               // Name of root bone
  ikChains?: IKChain[];            // IK solvers (if present)
}

/**
 * IK Chain - Inverse kinematics solver definition
 */
export interface IKChain {
  name: string;
  chain: string[];                 // Bone names in chain
  target: string;                  // End effector bone
  solver: 'twoBone' | 'ccd' | 'fabrik' | 'custom';
  iterations?: number;
  tolerance?: number;
}

/**
 * Morph Target Data - Generic morph target/blend shape
 */
export interface MorphTargetData {
  name: string;
  meshIndex: number;               // Which mesh in the scene
  morphTargetIndex: number;        // Which morph target on the mesh
  weight: number;                  // Current weight (0-1)
  influences?: number[];           // Vertex influences
}

/**
 * Animation Data - Animation clip information
 */
export interface AnimationData {
  name: string;
  duration: number;
  fps?: number;
  tracks: number;                  // Number of animation tracks
  skeleton?: SkeletonMetadata;     // Skeleton this animation is for
  format: ModelFormat;
  rootMotion?: boolean;            // Has root motion/translation
  loop?: boolean;
}

/**
 * Material Data - Material information
 */
export interface MaterialData {
  name: string;
  index: number;
  type: 'standard' | 'physical' | 'toon' | 'unlit' | 'custom';
  hasTextures: boolean;
  textureCount?: number;
  isTransparent?: boolean;
  isDoubleSided?: boolean;
}

/**
 * Texture Data - Texture information
 */
export interface TextureData {
  name: string;
  index: number;
  type: 'baseColor' | 'normal' | 'roughness' | 'metallic' | 'emissive' | 'custom';
  width: number;
  height: number;
  format: number;                  // THREE format constant
  size: number;                    // Size in bytes
}

/**
 * Model - Universal 3D model interface
 * Works with all supported formats (GLB, GLTF, VRM, FBX, PMX, etc.)
 */
export interface Model {
  // Core 3D data
  scene: THREE.Group;
  format: ModelFormat;
  metadata: ModelMetadata;

  // Skeleton (optional - static meshes won't have)
  skeleton?: THREE.Skeleton;
  skeletonMetadata?: SkeletonMetadata;

  // Animations
  animations?: THREE.AnimationClip[];
  animationData?: AnimationData[];

  // Morph targets / blend shapes (format-agnostic)
  morphTargets?: Map<string, MorphTargetData[]>;

  // Materials and textures
  materials?: THREE.Material[] | MaterialData[];
  textures?: THREE.Texture[] | TextureData[];

  // Format-specific data (preserve original structure)
  vrm?: VRMType;                   // VRM-specific data (only if format === 'vrm')
  fbx?: {                          // FBX-specific data
    version?: number;
    author?: string;
    creationDate?: string;
    application?: string;
    unitScale?: number;
    upAxis?: 'X' | 'Y' | 'Z';
    frontAxis?: 'X' | 'Y' | 'Z';
  };
  pmx?: {                          // PMX-specific data
    version?: number;
    name?: string;
    nameEnglish?: string;
    comment?: string;
    commentEnglish?: string;
  };

  // Performance info
  vertexCount?: number;
  triangleCount?: number;
  meshCount?: number;

  // Load info
  loadTime?: number;               // Milliseconds to load
  fileSize?: number;               // Size in bytes
}

/**
 * Model Load Options - Configuration for loading models
 */
export interface ModelLoadOptions {
  url?: string;
  file?: File;
  arrayBuffer?: ArrayBuffer;
  progressCallback?: (progress: LoadingProgress) => void;
  strictMode?: boolean;            // Fail on warnings
  generateMipmaps?: boolean;       // Generate texture mipmaps
  textureEncoding?: THREE.ColorSpace;
  computeVertexNormals?: boolean;  // Compute normals if missing
  optimizeMeshes?: boolean;        // Merge geometries where possible
  enableAnimations?: boolean;      // Load animations
  enableMorphTargets?: boolean;    // Load morph targets
  maxTextureSize?: number;         // Limit texture resolution
  skeletonType?: SkeletonType;     // Expected skeleton (for validation)
}

/**
 * Loading Progress - Load progress tracking
 */
export interface LoadingProgress {
  loaded: number;
  total: number;
  percentage: number;
  stage: LoadingStage;
  format?: ModelFormat;
  message?: string;
}

/**
 * Loading Stage - Current loading phase
 */
export type LoadingStage =
  | 'INITIALIZING'
  | 'DOWNLOADING'
  | 'PARSING'
  | 'PROCESSING'
  | 'OPTIMIZING'
  | 'FINALIZING'
  | 'COMPLETE'
  | 'ERROR';

/**
 * Loader Result - Result from model loader
 */
export interface LoaderResult<T = Model> {
  success: boolean;
  data?: T;
  error?: LoaderError;
  warnings?: LoaderWarning[];
  metadata?: {
    loadTime: number;
    fileSize: number;
    format: ModelFormat;
  };
}

/**
 * Loader Error - Detailed error information
 */
export interface LoaderError {
  type: LoaderErrorType;
  message: string;
  details?: unknown;
  stack?: string;
  format?: ModelFormat;
  stage?: LoadingStage;
}

/**
 * Loader Error Type - Categories of errors
 */
export type LoaderErrorType =
  | 'FILE_NOT_FOUND'
  | 'INVALID_FORMAT'
  | 'PARSE_ERROR'
  | 'VERSION_UNSUPPORTED'
  | 'RESOURCE_MISSING'
  | 'CORRUPTED_DATA'
  | 'NETWORK_ERROR'
  | 'QUOTA_EXCEEDED'
  | 'UNKNOWN';

/**
 * Loader Warning - Non-fatal issues
 */
export interface LoaderWarning {
  type: LoaderWarningType;
  message: string;
  details?: unknown;
  format?: ModelFormat;
}

/**
 * Loader Warning Type - Categories of warnings
 */
export type LoaderWarningType =
  | 'MISSING_TEXTURE'
  | 'UNSUPPORTED_FEATURE'
  | 'DEPRECATED_FORMAT'
  | 'PARTIAL_LOAD'
  | 'PERFORMANCE_WARNING'
  | 'LARGE_FILE'
  | 'OPTIMIZATION_RECOMMENDED';

/**
 * Model File Info - Information about a model file
 */
export interface ModelFileInfo {
  name: string;
  size: number;
  type: 'model' | 'animation';
  format: ModelFormat;
  lastModified: Date;
  assetType?: AssetType;
  hasThumbnail?: boolean;
}

/**
 * Format Capability Matrix - What each format supports
 */
export const FORMAT_CAPABILITIES: Record<ModelFormat, FormatCapabilities> = {
  glb: {
    supportsAnimations: true,
    supportsMorphTargets: true,
    supportsMaterials: true,
    supportsLighting: true,
    supportsCameras: true,
    supportsSkeleton: true,
    supportsTextures: true,
    compression: 'draco',
  },
  gltf: {
    supportsAnimations: true,
    supportsMorphTargets: true,
    supportsMaterials: true,
    supportsLighting: true,
    supportsCameras: true,
    supportsSkeleton: true,
    supportsTextures: true,
    compression: 'none',
  },
  vrm: {
    supportsAnimations: true,
    supportsMorphTargets: true,
    supportsMaterials: true,
    supportsLighting: false,
    supportsCameras: false,
    supportsSkeleton: true,
    supportsTextures: true,
    maxBoneCount: 55, // VRM humanoid bones
  },
  fbx: {
    supportsAnimations: true,
    supportsMorphTargets: true,
    supportsMaterials: true,
    supportsLighting: true,
    supportsCameras: true,
    supportsSkeleton: true,
    supportsTextures: true,
  },
  pmx: {
    supportsAnimations: true,
    supportsMorphTargets: true,
    supportsMaterials: true,
    supportsLighting: false,
    supportsCameras: false,
    supportsSkeleton: true,
    supportsTextures: true,
  },
  obj: {
    supportsAnimations: false,
    supportsMorphTargets: false,
    supportsMaterials: true,
    supportsLighting: false,
    supportsCameras: false,
    supportsSkeleton: false,
    supportsTextures: true,
  },
  vmd: {
    supportsAnimations: true,
    supportsMorphTargets: false,
    supportsMaterials: false,
    supportsLighting: false,
    supportsCameras: false,
    supportsSkeleton: true,
    supportsTextures: false,
  },
  bvh: {
    supportsAnimations: true,
    supportsMorphTargets: false,
    supportsMaterials: false,
    supportsLighting: false,
    supportsCameras: false,
    supportsSkeleton: true,
    supportsTextures: false,
  },
  vrma: {
    supportsAnimations: true,
    supportsMorphTargets: false,
    supportsMaterials: false,
    supportsLighting: false,
    supportsCameras: false,
    supportsSkeleton: true,
    supportsTextures: false,
  },
};

/**
 * Backward Compatibility - Type aliases for gradual migration
 */
// TODO: Remove these after migration complete
export type VRMModel = Model;
export type VRMMetadata = ModelMetadata;

/**
 * Utility type guards
 */
export function isVRM(model: Model): model is Model & { vrm: VRMType } {
  return model.format === 'vrm' && !!model.vrm;
}

export function hasSkeleton(model: Model): model is Model & { skeleton: THREE.Skeleton } {
  return !!model.skeleton;
}

export function hasMorphTargets(model: Model): model is Model & { morphTargets: Map<string, MorphTargetData[]> } {
  return !!model.morphTargets && model.morphTargets.size > 0;
}

export function hasAnimations(model: Model): model is Model & { animations: THREE.AnimationClip[] } {
  return !!model.animations && model.animations.length > 0;
}
