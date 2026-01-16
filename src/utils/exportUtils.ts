/**
 * Export Utilities
 * Helper functions for export operations
 */

import { saveAs } from 'file-saver';
import {
  ExportResult,
  ExportProgress,
  ExportValidationResult,
  ExportValidationError,
  ExportValidationWarning,
  ExportError,
  ExportErrorType,
} from '../types/export.types';

/**
 * Download file
 */
export function downloadFile(blob: Blob, filename: string): void {
  saveAs(blob, filename);
}

/**
 * Create export progress
 */
export function createExportProgress(
  stage: ExportProgress['stage'],
  progress: number,
  message: string,
  currentStep: number,
  totalSteps: number
): ExportProgress {
  return {
    stage,
    progress,
    message,
    currentStep,
    totalSteps,
  };
}

/**
 * Create export result
 */
export function createExportResult(
  success: boolean,
  data?: any,
  error?: ExportError
): ExportResult {
  return {
    success,
    data,
    error,
  };
}

/**
 * Create export error
 */
export function createExportError(
  type: ExportErrorType,
  message: string,
  details?: unknown,
  stage?: ExportProgress['stage']
): ExportError {
  return {
    type,
    message,
    details,
    stage,
  };
}

/**
 * Format file size
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Validate export options
 */
export function validateExportOptions(options: {
  name?: string;
  format?: string;
  metadata?: Record<string, unknown>;
}): ExportValidationResult {
  const errors: ExportValidationError[] = [];
  const warnings: ExportValidationWarning[] = [];

  // Validate name
  if (!options.name || options.name.trim() === '') {
    errors.push({
      field: 'name',
      message: 'Name is required',
      code: 'NAME_REQUIRED',
    });
  }

  // Validate format
  if (!options.format) {
    errors.push({
      field: 'format',
      message: 'Format is required',
      code: 'FORMAT_REQUIRED',
    });
  }

  // Validate metadata
  if (options.metadata) {
    if (!options.metadata.title && !options.metadata.author) {
      warnings.push({
        field: 'metadata',
        message: 'Title and author should be provided',
        code: 'METADATA_INCOMPLETE',
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Generate export filename
 */
export function generateExportFilename(
  baseName: string,
  format: string,
  version?: string
): string {
  const sanitizedName = baseName.replace(/[^a-zA-Z0-9_-]/g, '_');

  if (version) {
    return `${sanitizedName}_${version}.${format}`;
  }

  return `${sanitizedName}.${format}`;
}

/**
 * Get export quality info
 */
export function getExportQualityInfo(quality: 'low' | 'medium' | 'high' | 'ultra') {
  const qualityMap = {
    low: {
      name: 'Low',
      description: 'Smallest file size, lower quality',
      compressionLevel: 0.5,
      textureQuality: 512,
      meshSimplification: 0.8,
    },
    medium: {
      name: 'Medium',
      description: 'Balanced file size and quality',
      compressionLevel: 0.7,
      textureQuality: 1024,
      meshSimplification: 0.9,
    },
    high: {
      name: 'High',
      description: 'Larger file size, higher quality',
      compressionLevel: 0.85,
      textureQuality: 2048,
      meshSimplification: 0.95,
    },
    ultra: {
      name: 'Ultra',
      description: 'Largest file size, maximum quality',
      compressionLevel: 1.0,
      textureQuality: 4096,
      meshSimplification: 1.0,
    },
  };

  return qualityMap[quality];
}

/**
 * Get export compression info
 */
export function getExportCompressionInfo(compression: 'none' | 'draco' | 'meshopt') {
  const compressionMap = {
    none: {
      name: 'None',
      description: 'No compression applied',
      compressionRatio: 1.0,
      supportedFormats: ['vrm', 'vrma', 'gltf', 'glb'],
    },
    draco: {
      name: 'Draco',
      description: 'Draco mesh compression',
      compressionRatio: 0.6,
      supportedFormats: ['vrm', 'vrma', 'gltf', 'glb'],
    },
    meshopt: {
      name: 'Meshopt',
      description: 'Mesh optimization compression',
      compressionRatio: 0.5,
      supportedFormats: ['vrm', 'vrma', 'gltf', 'glb'],
    },
  };

  return compressionMap[compression];
}

/**
 * Calculate export progress percentage
 */
export function calculateProgressPercentage(
  currentStep: number,
  totalSteps: number
): number {
  if (totalSteps === 0) return 0;
  return Math.round((currentStep / totalSteps) * 100);
}

/**
 * Estimate export time
 */
export function estimateExportTime(
  fileSize: number,
  quality: 'low' | 'medium' | 'high' | 'ultra'
): number {
  const baseTime = fileSize / (1024 * 1024); // Base time in seconds for 1MB at medium quality

  const qualityMultiplier = {
    low: 2.0,
    medium: 1.0,
    high: 0.5,
    ultra: 0.25,
  };

  return baseTime * qualityMultiplier[quality];
}

/**
 * Check if export is supported
 */
export function isExportSupported(format: string): boolean {
  const supportedFormats = ['vrm', 'vrma', 'gltf', 'glb'];
  return supportedFormats.includes(format.toLowerCase());
}

/**
 * Get export format extension
 */
export function getExportFormatExtension(format: string): string {
  const formatMap: Record<string, string> = {
    vrm: 'vrm',
    vrma: 'vrma',
    gltf: 'gltf+json',
    glb: 'glb',
  };

  return formatMap[format.toLowerCase()] || 'bin';
}

/**
 * Validate blob size
 */
export function validateBlobSize(blob: Blob, maxSize: number = 500 * 1024 * 1024): boolean {
  return blob.size <= maxSize;
}

/**
 * Get MIME type for format
 */
export function getMimeTypeForFormat(format: string): string {
  const mimeMap: Record<string, string> = {
    vrm: 'application/octet-stream',
    vrma: 'application/octet-stream',
    gltf: 'model/gltf+json',
    glb: 'model/gltf-binary',
  };

  return mimeMap[format.toLowerCase()] || 'application/octet-stream';
}

/**
 * Sanitize filename
 */
export function sanitizeFilename(filename: string): string {
  // Remove any path traversal attempts
  const sanitized = filename.replace(/[\\/:*?"<>|]/g, '_');

  // Remove control characters
  return sanitized.replace(/[\x00-\x1f\x7f-\x9f]/g, '');
}

/**
 * Create export summary
 */
export function createExportSummary(result: ExportResult): string {
  if (!result.success || !result.data) {
    return 'Export failed';
  }

  const { filename, size, format, duration } = result.data;

  const sizeFormatted = formatFileSize(size);
  const summary = [
    `File: ${filename}`,
    `Format: ${format}`,
    `Size: ${sizeFormatted}`,
  ];

  if (duration) {
    summary.push(`Duration: ${duration.toFixed(2)}s`);
  }

  return summary.join('\n');
}

/**
 * Track export progress
 */
export class ExportProgressTracker {
  private startTime: number = 0;
  private lastUpdate: number = 0;
  private progressCallback?: (progress: ExportProgress) => void;

  constructor(callback?: (progress: ExportProgress) => void) {
    this.progressCallback = callback;
    this.startTime = Date.now();
    this.lastUpdate = this.startTime;
  }

  /**
   * Update progress
   */
  update(progress: ExportProgress): void {
    const now = Date.now();
    const elapsed = (now - this.startTime) / 1000; // Convert to seconds

    // Throttle updates to at most once per 100ms
    if (now - this.lastUpdate >= 100) {
      this.lastUpdate = now;

      if (this.progressCallback) {
        this.progressCallback({
          ...progress,
          timeElapsed: elapsed,
          timeRemaining: this.calculateTimeRemaining(progress.progress, elapsed),
        });
      }
    }
  }

  /**
   * Calculate time remaining
   */
  private calculateTimeRemaining(progress: number, elapsed: number): number {
    if (progress >= 100) return 0;
    if (progress <= 0) return 0;

    const rate = progress / elapsed; // Progress per second
    const remaining = (100 - progress) / rate;
    return Math.max(0, Math.round(remaining));
  }

  /**
   * Complete
   */
  complete(): void {
    if (this.progressCallback) {
      this.progressCallback({
        stage: 'COMPLETE',
        progress: 100,
        message: 'Export complete',
        currentStep: 1,
        totalSteps: 1,
      });
    }
  }
}
