/**
 * Database Schema
 * Defines the Dexie.js database schema for VRM Viewer
 * Supports universal 3D model and animation formats
 */

import Dexie, { Table } from 'dexie';

/**
 * Asset Type - Categories for different asset purposes
 */
export enum AssetType {
  CHARACTER = 'character',
  CREATURE = 'creature',
  PROP = 'prop',
  VEHICLE = 'vehicle',
  ENVIRONMENT = 'environment',
  EFFECT = 'effect',
  OTHER = 'other',
}

/**
 * Skeleton Type - Types of skeleton rigs
 */
export enum SkeletonType {
  HUMANOID = 'humanoid',
  QUADRUPED = 'quadruped',
  BIPED = 'biped',
  AVIAN = 'avian',
  FISH = 'fish',
  CUSTOM = 'custom',
  NONE = 'none',
}

/**
 * Skeleton Metadata
 */
export interface SkeletonMetadata {
  type: SkeletonType;
  boneCount: number;
  hasRootBone?: boolean;
  hasHipBones?: boolean;
  hasSpine?: boolean;
}

/**
 * Extended Animation Record
 * Supports all animation formats
 */
export interface ExtendedAnimationRecord {
  id?: number;
  uuid: string;
  name: string;
  displayName: string;
  description?: string;
  category?: string;
  tags: string[];
  // Extended format support
  format: 'vrm' | 'vrma' | 'gltf' | 'glb' | 'fbx' | 'bvh' | 'vmd' | 'pmx';
  duration: number;
  fps?: number;
  frameCount?: number;
  // Skeleton metadata for retargeting
  skeletonType?: SkeletonType;
  sourceSkeleton?: SkeletonMetadata;
  // Authorship
  author?: string;
  license?: string;
  thumbnail?: string;
  data: ArrayBuffer;
  createdAt: Date;
  updatedAt: Date;
  size: number;
  order: number;
}

/**
 * Extended Model Record
 * Supports all model formats and asset types
 */
export interface ExtendedModelRecord {
  id?: number;
  uuid: string;
  name: string;
  displayName: string;
  description?: string;
  category?: string;
  tags: string[];
  // Extended format support
  format: 'vrm' | 'vrma' | 'gltf' | 'glb' | 'fbx' | 'bvh' | 'vmd' | 'pmx' | 'obj';
  version: '0.0' | '1.0' | 'unknown';
  // Asset categorization
  assetType: AssetType;
  // Skeleton metadata
  skeletonMetadata?: SkeletonMetadata;
  // VRM-specific metadata (optional)
  vrm?: {
    title: string;
    version: string;
    author: string;
    contactInformation?: string;
    reference?: string;
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
    thumbnail?: string;
    licenseUrl?: string;
  };
  // Authorship
  author?: string;
  license?: string;
  thumbnail?: string;
  data: ArrayBuffer;
  createdAt: Date;
  updatedAt: Date;
  size: number;
  order: number;
}

/**
 * Preference Record
 * User preferences stored in the database
 */
export interface PreferenceRecord {
  id?: number;
  key: string;
  value: string; // JSON stringified value
  updatedAt: Date;
}

/**
 * Thumbnail Record
 */
export interface ThumbnailRecord {
  id?: number;
  uuid: string;
  name: string;
  type: 'animation' | 'model';
  targetUuid: string;
  data: string; // base64 encoded image
  format: 'png' | 'jpeg' | 'webp';
  width: number;
  height: number;
  size: number;
  createdAt: Date;
}

/**
 * VRM Viewer Database
 * Main database class extending Dexie
 * Schema version 3: Added asset type and extended format support
 */
export class VRMViewerDatabase extends Dexie {
  // Tables
  animations!: Table<ExtendedAnimationRecord, number>;
  models!: Table<ExtendedModelRecord, number>;
  thumbnails!: Table<ThumbnailRecord, number>;
  preferences!: Table<PreferenceRecord, number>;

  constructor() {
    super('VRMViewerDB');

    // Define schema version 3
    this.version(3).stores({
      // Animations table
      animations: '++id, uuid, name, displayName, description, category, format, skeletonType, duration, createdAt, updatedAt, size, *tags',
      // Models table
      models: '++id, uuid, name, displayName, description, category, format, assetType, createdAt, updatedAt, size, *tags',
      // Thumbnails table
      thumbnails: '++id, uuid, name, type, targetUuid, createdAt',
      // Preferences table
      preferences: '++id, key, updatedAt',
    });
  }
}

/**
 * Database singleton instance
 */
let dbInstance: VRMViewerDatabase | null = null;

/**
 * Get database instance
 * @returns Database instance
 */
export function getDatabase(): VRMViewerDatabase {
  if (!dbInstance) {
    dbInstance = new VRMViewerDatabase();
  }
  return dbInstance;
}

/**
 * Close database connection
 */
export async function closeDatabase(): Promise<void> {
  if (dbInstance) {
    await dbInstance.close();
    dbInstance = null;
  }
}

/**
 * Delete database
 */
export async function deleteDatabase(): Promise<void> {
  if (dbInstance) {
    await dbInstance.delete();
    dbInstance = null;
  } else {
    await Dexie.delete('VRMViewerDB');
  }
}

/**
 * Database schema versions
 */
export const SCHEMA_VERSIONS = {
  CURRENT: 3,
  VERSIONS: [
    {
      version: 1,
      description: 'Initial schema with animations, models, and thumbnails tables',
    },
    {
      version: 2,
      description: 'Added preferences table for user settings',
    },
    {
      version: 3,
      description: 'Added assetType, skeletonMetadata, extended format support (vrm, vrma, gltf, glb, fbx, bvh, vmd, pmx, obj)',
    },
  ],
};

/**
 * Database configuration
 */
export const DATABASE_CONFIG = {
  NAME: 'VRMViewerDB',
  VERSION: 3,
  MAX_SIZE: 500 * 1024 * 1024, // 500MB default
  CHUNK_SIZE: 1024 * 1024, // 1MB chunks for large files
};

/**
 * Index definitions for animations table
 */
export const ANIMATION_INDEXES = {
  UUID: 'uuid',
  NAME: 'name',
  DISPLAY_NAME: 'displayName',
  DESCRIPTION: 'description',
  CATEGORY: 'category',
  FORMAT: 'format',
  SKELETON_TYPE: 'skeletonType',
  DURATION: 'duration',
  CREATED_AT: 'createdAt',
  UPDATED_AT: 'updatedAt',
  SIZE: 'size',
  TAGS: '*tags',
};

/**
 * Index definitions for models table
 */
export const MODEL_INDEXES = {
  UUID: 'uuid',
  NAME: 'name',
  DISPLAY_NAME: 'displayName',
  DESCRIPTION: 'description',
  CATEGORY: 'category',
  FORMAT: 'format',
  ASSET_TYPE: 'assetType',
  CREATED_AT: 'createdAt',
  UPDATED_AT: 'updatedAt',
  SIZE: 'size',
  TAGS: '*tags',
};

/**
 * Index definitions for thumbnails table
 */
export const THUMBNAIL_INDEXES = {
  UUID: 'uuid',
  NAME: 'name',
  TYPE: 'type',
  TARGET_UUID: 'targetUuid',
  CREATED_AT: 'createdAt',
};

/**
 * Format support matrix
 */
export const FORMAT_SUPPORT = {
  // Model formats
  vrm_model: { type: 'model', assetTypes: [AssetType.CHARACTER] },
  glb_model: { type: 'model', assetTypes: Object.values(AssetType) },
  gltf_model: { type: 'model', assetTypes: Object.values(AssetType) },
  fbx_model: { type: 'model', assetTypes: Object.values(AssetType) },
  pmx_model: { type: 'model', assetTypes: [AssetType.CHARACTER, AssetType.CREATURE] },
  obj_model: { type: 'model', assetTypes: [AssetType.PROP, AssetType.ENVIRONMENT] },

  // Animation formats
  vrma_anim: { type: 'animation', skeletonTypes: [SkeletonType.HUMANOID] },
  bvh_anim: { type: 'animation', skeletonTypes: Object.values(SkeletonType) },
  vmd_anim: { type: 'animation', skeletonTypes: [SkeletonType.HUMANOID] },
};
