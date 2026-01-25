/**
 * Database Types
 * Defines types for IndexedDB database entities and operations
 */

/**
 * Animation Record
 * Represents a saved animation in the database
 */
export interface AnimationRecord {
  id?: number;
  uuid: string;
  name: string;
  displayName: string;
  description?: string;
  category?: string;
  tags: string[];
  format: 'bvh' | 'vrma' | 'gltf' | 'fbx';
  duration: number;
  fps?: number;
  frameCount?: number;
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
 * Model Record
 * Represents a saved model in the database
 */
export interface ModelRecord {
  id?: number;
  uuid: string;
  name: string;
  displayName: string;
  description?: string;
  category?: string;
  tags: string[];
  format: 'vrm' | 'gltf' | 'glb' | 'fbx';
  version: '0.0' | '1.0';
  author?: string;
  license?: string;
  thumbnail?: string;
  data: ArrayBuffer;
  metadata?: ModelMetadata;
  createdAt: Date;
  updatedAt: Date;
  size: number;
  order: number;
}

/**
 * Model Metadata
 * Additional metadata for models
 */
export interface ModelMetadata {
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
