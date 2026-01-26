/**
 * Database Types
 * Defines types for IndexedDB database entities and operations
 * Updated to support universal 3D model and animation formats
 */

import { AssetType, SkeletonType } from '../core/database/schemas/databaseSchema';

/**
 * Animation Record
 * Represents a saved animation in the database
 * Extended to support all animation formats
 */
export interface AnimationRecord {
  id?: number;
  uuid: string;
  name: string;
  displayName: string;
  description?: string;
  category?: string;
  tags: string[];
  // Extended format support
  format: AnimationFormat;
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
 * Animation Format
 * All supported animation formats
 */
export type AnimationFormat = 'vrm' | 'vrma' | 'gltf' | 'glb' | 'fbx' | 'bvh' | 'vmd' | 'pmx';

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
 * Model Record
 * Represents a saved model in the database
 * Extended to support all model formats
 */
export interface ModelRecord {
  id?: number;
  uuid: string;
  name: string;
  displayName: string;
  description?: string;
  category?: string;
  tags: string[];
  // Extended format support
  format: ModelFormat;
  version: ModelVersion;
  // Asset categorization
  assetType: AssetType;
  // Skeleton metadata
  skeletonMetadata?: SkeletonMetadata;
  // VRM-specific metadata (optional)
  vrm?: VRMMetadata;
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
 * Model Format
 * All supported model formats
 */
export type ModelFormat = 'vrm' | 'vrma' | 'gltf' | 'glb' | 'fbx' | 'bvh' | 'vmd' | 'pmx' | 'obj';

/**
 * Model Version
 */
export type ModelVersion = '0.0' | '1.0' | 'unknown';

/**
 * VRM Metadata
 */
export interface VRMMetadata {
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
}

/**
 * Thumbnail Record
 * Represents a saved thumbnail in the database
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
 * Database Query Options
 * Options for querying the database
 */
export interface DatabaseQueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: 'name' | 'createdAt' | 'updatedAt' | 'size';
  orderDirection?: 'asc' | 'desc';
  search?: string;
  tags?: string[];
  category?: string;
  format?: string;
  assetType?: AssetType;
  skeletonType?: SkeletonType;
  startDate?: Date;
  endDate?: Date;
}

/**
 * Database Query Result
 * Result of a database query
 */
export interface DatabaseQueryResult<T> {
  data: T[];
  total: number;
  page?: number;
  pageSize?: number;
  hasMore: boolean;
}

/**
 * Database Operation Result
 * Result of a database operation
 */
export interface DatabaseOperationResult<T = void> {
  success: boolean;
  data?: T;
  error?: DatabaseError;
}

/**
 * Database Error
 * Error from database operations
 */
export interface DatabaseError {
  type: DatabaseErrorType;
  message: string;
  details?: unknown;
  code?: string;
}

/**
 * Database Error Type
 */
export type DatabaseErrorType =
  | 'QUOTA_EXCEEDED'
  | 'NOT_FOUND'
  | 'CONSTRAINT_ERROR'
  | 'TRANSACTION_ERROR'
  | 'NETWORK_ERROR'
  | 'UNKNOWN';

/**
 * Database Statistics
 * Statistics about the database
 */
export interface DatabaseStatistics {
  totalAnimations: number;
  totalModels: number;
  totalSize: number;
  oldestRecord?: Date;
  newestRecord?: Date;
  formats: Record<string, number>;
  categories: Record<string, number>;
  assetTypes?: Record<string, number>;
  skeletonTypes?: Record<string, number>;
}

/**
 * Bulk Operation Options
 * Options for bulk database operations
 */
export interface BulkOperationOptions {
  batchSize?: number;
  continueOnError?: boolean;
  progressCallback?: (progress: BulkOperationProgress) => void;
}

/**
 * Bulk Operation Progress
 * Progress of a bulk operation
 */
export interface BulkOperationProgress {
  completed: number;
  total: number;
  percentage: number;
  current?: string;
  errors: DatabaseError[];
}

/**
 * Database Migration
 * Represents a database migration
 */
export interface DatabaseMigration {
  version: number;
  name: string;
  up: (db: unknown) => Promise<void>;
  down?: (db: unknown) => Promise<void>;
}

/**
 * Database Schema Version
 */
export interface DatabaseSchemaVersion {
  version: number;
  name: string;
  appliedAt: Date;
}

/**
 * Index Definition
 * Definition of a database index
 */
export interface IndexDefinition {
  name: string;
  keyPath: string | string[];
  options?: {
    unique?: boolean;
    multiEntry?: boolean;
  };
}
