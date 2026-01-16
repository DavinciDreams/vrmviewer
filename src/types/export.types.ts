/**
 * Export Types
 * Defines types for export functionality
 */

import { VRMMetadata } from './vrm.types';

/**
 * Export Format
 */
export type ExportFormat = 'vrm' | 'vrma' | 'gltf' | 'glb';

/**
 * Export Quality
 */
export type ExportQuality = 'low' | 'medium' | 'high' | 'ultra';

/**
 * Export Compression
 */
export type ExportCompression = 'none' | 'draco' | 'meshopt';

/**
 * Export Options
 * Common export options for all formats
 */
export interface ExportOptions {
  format: ExportFormat;
  quality: ExportQuality;
  compression: ExportCompression;
  includeAnimations?: boolean;
  includeBlendShapes?: boolean;
  includeMaterials?: boolean;
  includeTextures?: boolean;
  includeThumbnail?: boolean;
  generateThumbnail?: boolean;
  thumbnailSize?: ThumbnailSize;
  binary?: boolean;
  pretty?: boolean;
  customExtensions?: boolean;
}

/**
 * VRM Export Options
 * Specific options for VRM export
 */
export interface VRMExportOptions extends ExportOptions {
  format: 'vrm';
  version: '0.0' | '1.0';
  metadata: VRMMetadata;
  removeUnnecessaryVertices?: boolean;
  combineSkeletons?: boolean;
  combineMorphs?: boolean;
}

/**
 * VRMA Export Options
 * Specific options for VRMA export
 */
export interface VRMAExportOptions extends ExportOptions {
  format: 'vrma';
  animationName: string;
  animationDuration?: number;
  animationFPS?: number;
  includeHumanoid?: boolean;
  includeExpression?: boolean;
  includeLookAt?: boolean;
}

/**
 * GLTF Export Options
 * Specific options for GLTF/GLB export
 */
export interface GLTFExportOptions extends ExportOptions {
  format: 'gltf' | 'glb';
  exportCameras?: boolean;
  exportLights?: boolean;
  embedImages?: boolean;
  maxTextureSize?: number;
}

/**
 * Thumbnail Size
 */
export type ThumbnailSize = 'small' | 'medium' | 'large' | 'original';

/**
 * Thumbnail Size Dimensions
 */
export interface ThumbnailDimensions {
  small: { width: 128; height: 128 };
  medium: { width: 256; height: 256 };
  large: { width: 512; height: 512 };
  original: { width: number; height: number };
}

/**
 * Export Progress
 * Progress information for export operation
 */
export interface ExportProgress {
  stage: ExportStage;
  progress: number; // 0-100
  message: string;
  currentStep: number;
  totalSteps: number;
  bytesProcessed?: number;
  bytesTotal?: number;
  timeElapsed?: number;
  timeRemaining?: number;
}

/**
 * Export Stage
 */
export type ExportStage =
  | 'INITIALIZING'
  | 'PREPARING'
  | 'PROCESSING'
  | 'COMPRESSING'
  | 'GENERATING_THUMBNAIL'
  | 'FINALIZING'
  | 'COMPLETE'
  | 'ERROR';

/**
 * Export Result
 * Result of an export operation
 */
export interface ExportResult {
  success: boolean;
  data?: ExportData;
  error?: ExportError;
  progress?: ExportProgress;
}

/**
 * Export Data
 * Data from successful export
 */
export interface ExportData {
  blob: Blob;
  url: string;
  filename: string;
  size: number;
  format: ExportFormat;
  thumbnail?: string;
  metadata?: VRMMetadata;
  duration?: number;
}

/**
 * Export Error
 * Error from export operation
 */
export interface ExportError {
  type: ExportErrorType;
  message: string;
  details?: unknown;
  stage?: ExportStage;
  stack?: string;
}

/**
 * Export Error Type
 */
export type ExportErrorType =
  | 'NO_MODEL_LOADED'
  | 'NO_ANIMATION_LOADED'
  | 'INVALID_FORMAT'
  | 'EXPORT_FAILED'
  | 'COMPRESSION_FAILED'
  | 'THUMBNAIL_FAILED'
  | 'QUOTA_EXCEEDED'
  | 'UNKNOWN';

/**
 * Export Validation Result
 * Result of export validation
 */
export interface ExportValidationResult {
  valid: boolean;
  errors: ExportValidationError[];
  warnings: ExportValidationWarning[];
}

/**
 * Export Validation Error
 */
export interface ExportValidationError {
  field: string;
  message: string;
  code: string;
}

/**
 * Export Validation Warning
 */
export interface ExportValidationWarning {
  field: string;
  message: string;
  code: string;
}

/**
 * Export Metadata
 * Metadata for export
 */
export interface ExportMetadata {
  name: string;
  displayName: string;
  description?: string;
  author?: string;
  version?: string;
  license?: string;
  contactInformation?: string;
  reference?: string;
  thumbnail?: string;
  tags?: string[];
  category?: string;
}

/**
 * Export Configuration
 * Complete export configuration
 */
export interface ExportConfiguration {
  options: ExportOptions;
  metadata: ExportMetadata;
  filename: string;
  destination?: 'download' | 'database' | 'both';
  saveToDatabase?: boolean;
  generateThumbnail?: boolean;
  overwriteExisting?: boolean;
}

/**
 * Export Batch Options
 * Options for batch export
 */
export interface ExportBatchOptions {
  items: ExportConfiguration[];
  continueOnError?: boolean;
  progressCallback?: (progress: ExportBatchProgress) => void;
}

/**
 * Export Batch Progress
 * Progress of batch export
 */
export interface ExportBatchProgress {
  completed: number;
  total: number;
  percentage: number;
  current?: string;
  results: ExportResult[];
  errors: ExportError[];
}

/**
 * Export Format Info
 * Information about export format
 */
export interface ExportFormatInfo {
  format: ExportFormat;
  name: string;
  extension: string;
  mimeType: string;
  supportsAnimations: boolean;
  supportsMaterials: boolean;
  supportsTextures: boolean;
  supportsCompression: boolean;
  maxSize?: number;
  description: string;
}

/**
 * Export Quality Info
 * Information about export quality
 */
export interface ExportQualityInfo {
  quality: ExportQuality;
  name: string;
  description: string;
  compressionLevel: number;
  textureQuality: number;
  meshSimplification?: number;
}

/**
 * Export Compression Info
 * Information about export compression
 */
export interface ExportCompressionInfo {
  compression: ExportCompression;
  name: string;
  description: string;
  compressionRatio: number;
  supportedFormats: ExportFormat[];
}
