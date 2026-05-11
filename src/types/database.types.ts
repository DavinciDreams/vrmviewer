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
}

/**
 * Extracted Model Metadata
 *
 * Rich, format-agnostic metadata produced by the extraction pipeline
 * (`src/core/metadata/`). Stored as a JSON blob on the model record;
 * callers can opt in to populating it at save time by passing an
 * ExtractedBundle to `ModelService.saveModel` (not yet wired into the
 * default save path — invoke directly or via `scripts/extract-metadata.mjs`).
 */
export interface ExtractedModelMetadata {
  schemaVersion: 1;
  extractedAt: Date;
  extractorVersion: string;
  geometry: {
    triangleCount: number;
    vertexCount: number;
    meshCount: number;
    boundingBox: { min: [number, number, number]; max: [number, number, number] };
    height: number;
    polyBucket: 'low' | 'mid' | 'high' | 'ultra';
  };
  rig: {
    boneCount: number;
    isHumanoid: boolean;
    /** VRMHumanBoneName values kept as string[] to avoid cross-type coupling. */
    humanoidBonesPresent: string[];
    humanoidCompleteness: number;
    expressionCount: number;
    expressionPresets: string[];
    customExpressions: string[];
    blendShapeCount: number;
  };
  materials: {
    materialCount: number;
    textureCount: number;
    totalTextureBytes: number;
    materialTypes: { mtoon: number; pbr: number; basic: number; other: number };
    hasTransparency: boolean;
    largestTextureResolution: [number, number];
  };
  hashes: {
    sha256: string;
    pHash?: string;
  };
  sourceFormat: {
    format: string;
    version: string;
    hasAnimations: boolean;
    animationCount: number;
  };
}

/**
 * Normalized License — works for both VRM 0.x and VRM 1.0 license schemas.
 */
export interface NormalizedLicense {
  licenseName?: string;
  licenseUrl?: string;
  otherLicenseUrl?: string;
  allowedUserName?: 'OnlyAuthor' | 'ExplicitlyLicensedPerson' | 'Everyone';
  commercialUsage?: 'Disallow' | 'Allow' | 'PersonalNonProfit' | 'PersonalProfit' | 'Corporation';
  violentUsage?: 'Disallow' | 'Allow';
  sexualUsage?: 'Disallow' | 'Allow';
  politicalOrReligiousUsage?: 'Disallow' | 'Allow';
  antisocialOrHateUsage?: 'Disallow' | 'Allow';
  modification?: 'Prohibited' | 'AllowModification' | 'AllowModificationRedistribution';
  creditNotation?: 'Required' | 'Unnecessary';
  allowRedistribution?: 'Disallow' | 'Allow';
}

/**
 * Model Record
 * Represents a saved model in the database.
 *
 * The bottom block of optional fields is populated by the extraction
 * pipeline (`src/core/metadata/`). They are all optional so records
 * predating the pipeline still load.
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

  // --- Extraction-pipeline fields (all optional) ---

  /** SHA-256 of the raw model file. Used for dedup. */
  sha256?: string;
  /** Polygon complexity bucket; suitable for faceted filtering. */
  polyBucket?: 'low' | 'mid' | 'high' | 'ultra';
  /** Whether the rig satisfies the VRM humanoid spec. */
  isHumanoid?: boolean;
  /** VRMHumanBoneName values present in the rig. */
  humanoidBones?: string[];
  /** Tokenized search terms for free-text search. */
  searchTokens?: string[];
  /** Full extraction result blob (not indexed). */
  extractedMetadata?: ExtractedModelMetadata;
  /** Normalized license data from VRM 0.x or 1.0 metadata. */
  normalizedLicense?: NormalizedLicense;
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
 * Persisted State Record
 * Key-value entry for arbitrary state (e.g. Zustand `persist` payloads).
 * `key` is the primary key.
 */
export interface PersistedStateRecord {
  key: string;
  value: string;
  updatedAt: Date;
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

  // Extraction-pipeline-driven faceted filters (all optional).
  polyBucket?: 'low' | 'mid' | 'high' | 'ultra';
  isHumanoid?: boolean;
  license?: string;
  /**
   * When true, restrict to records where normalizedLicense.commercialUsage
   * indicates commercial use is permitted.
   */
  hasCommercialUse?: boolean;
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
