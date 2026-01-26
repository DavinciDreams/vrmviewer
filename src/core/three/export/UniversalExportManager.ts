/**
 * Universal Export Manager
 * Orchestrates export to all supported formats
 * Primary interface for export functionality
 */

import * as THREE from 'three';
import { getVRMExporter } from './VRMExporter';
import { getVRMAExporter } from './VRMAExporter';
import { getGLTFExporterEnhanced } from './GLTFExporterEnhanced';
import { getFBXExporter } from './FBXExporterEnhanced';
import { getBVHExporter } from './BVHExporter';
import {
  ModelFormat,
  Model,
} from '../../../types/model.types';
import {
  ExportResult,
  ExportProgress,
  ExportError,
} from '../../../types/export.types';

/**
 * Universal export options
 */
export interface UniversalExportOptions {
  // Format selection (one or multiple for batch export)
  formats: ModelFormat[];

  // Common options (apply to all formats)
  quality: 'low' | 'medium' | 'high' | 'ultra';
  includeAnimations: boolean;
  includeMorphTargets: boolean;
  includeTextures: boolean;
  compressTextures: boolean;
  textureQuality: number; // 0-100
  optimizeMesh: boolean;
  removeUnusedBones: boolean;
  animationSampleRate: number; // FPS for animation export

  // Metadata
  name?: string;
  author?: string;
  title?: string;
  description?: string;
  version?: string;

  // Progress tracking
  onProgress?: (progress: ExportProgress) => void;

  // Batch export (export to multiple formats at once)
  batch?: boolean;
}

/**
 * Export result with format
 */
export interface UniversalExportResult extends ExportResult {
  format: ModelFormat;
}

/**
 * Batch export result
 */
export interface BatchExportResult {
  success: boolean;
  results: Map<ModelFormat, UniversalExportResult>;
  errors: Map<ModelFormat, ExportError>;
  totalFormats: number;
  successfulFormats: number;
  failedFormats: number;
}

/**
 * Universal Export Manager Class
 */
export class UniversalExportManager {
  private exporters: Map<string, any>;

  constructor() {
    this.exporters = new Map<string, any>([
      ['glb', getGLTFExporterEnhanced()],
      ['gltf', getGLTFExporterEnhanced()],
      ['vrm', getVRMExporter()],
      ['fbx', getFBXExporter()],
      ['bvh', getBVHExporter()],
      ['vrma', getVRMAExporter()],
    ]);
  }

  /**
   * Export model to a single format
   */
  async exportToFormat(
    modelOrAnimation: THREE.Group | THREE.AnimationClip,
    format: ModelFormat,
    options: UniversalExportOptions
  ): Promise<UniversalExportResult> {
    try {
      // Validate format
      if (!this.exporters.has(format)) {
        return {
          success: false,
          format,
          error: {
            type: 'UNSUPPORTED_FORMAT',
            message: `Export to ${format.toUpperCase()} is not supported`,
          },
        };
      }

      // Get appropriate exporter
      const exporter = this.exporters.get(format);

      // Convert universal options to format-specific options
      const specificOptions = this.convertOptions(format, options);

      // Export
      const result = await this.exportWithExporter(
        exporter,
        modelOrAnimation,
        format,
        specificOptions,
        options.onProgress
      );

      return result;
    } catch (error) {
      console.error(`Export to ${format} failed:`, error);

      return {
        success: false,
        format,
        error: {
          type: 'EXPORT_FAILED',
          message: `Failed to export to ${format.toUpperCase()}`,
          details: error,
        },
      };
    }
  }

  /**
   * Export to multiple formats (batch export)
   */
  async exportBatch(
    modelOrAnimation: THREE.Group | THREE.AnimationClip,
    formats: ModelFormat[],
    options: UniversalExportOptions
  ): Promise<BatchExportResult> {
    const results = new Map<ModelFormat, UniversalExportResult>();
    const errors = new Map<ModelFormat, ExportError>();

    for (const format of formats) {
      try {
        const result = await this.exportToFormat(modelOrAnimation, format, {
          ...options,
          onProgress: (progress) => {
            options.onProgress?.(progress);
          },
        });

        if (result.success) {
          results.set(format, result);
        } else if (result.error) {
          errors.set(format, result.error);
        }
      } catch (error) {
        errors.set(format, {
          type: 'EXPORT_FAILED',
          message: `Failed to export to ${format.toUpperCase()}`,
          details: error,
        });
      }
    }

    const successfulFormats = results.size;
    const failedFormats = errors.size;

    return {
      success: failedFormats === 0,
      results,
      errors,
      totalFormats: formats.length,
      successfulFormats,
      failedFormats,
    };
  }

  /**
   * Export with specific exporter
   */
  private async exportWithExporter(
    exporter: any,
    modelOrAnimation: THREE.Group | THREE.AnimationClip,
    format: ModelFormat,
    options: any,
    onProgress?: (progress: ExportProgress) => void
  ): Promise<UniversalExportResult> {
    let result: ExportResult;

    // Choose export method based on format
    switch (format) {
      case 'bvh':
        // BVH animation export
        result = await exporter.export(modelOrAnimation as THREE.AnimationClip, options, onProgress);
        break;
      case 'vrma':
        // VRMA animation export
        result = await exporter.exportVRMA(modelOrAnimation as THREE.AnimationClip, options, onProgress);
        break;
      case 'glb':
      case 'gltf':
        // GLTF/GLB model export
        result = await exporter.exportGLTF(modelOrAnimation as THREE.Group, options, onProgress);
        break;
      case 'vrm':
        // VRM model export
        result = await exporter.exportVRM(modelOrAnimation as THREE.Group, options, onProgress);
        break;
      case 'fbx':
        // FBX model export
        result = await exporter.exportFBX(modelOrAnimation as THREE.Group, options, onProgress);
        break;
      default:
        return {
          success: false,
          format,
          error: {
            type: 'UNSUPPORTED_FORMAT',
            message: `Export to ${format.toUpperCase()} is not supported`,
          },
        };
    }

    // Add format to result
    if (result.success && result.data) {
      return {
        ...result,
        format,
      };
    }

    // Add format to error result
    return {
      ...result,
      format,
    };
  }

  /**
   * Convert universal options to format-specific options
   */
  private convertOptions(
    format: ModelFormat,
    universal: UniversalExportOptions
  ): any {
    // Base options common to all formats
    const baseOptions = {
      quality: universal.quality,
      binary: format === 'glb' || format === 'fbx',
      generateThumbnail: false, // TODO: Add thumbnail generation
      metadata: {
        title: universal.title || universal.name || 'Model',
        version: universal.version || '1.0',
        author: universal.author || 'Unknown',
        description: universal.description,
      },
    };

    switch (format) {
      case 'glb':
      case 'gltf':
        return {
          ...baseOptions,
          format,
          includeAnimations: universal.includeAnimations,
          includeBlendShapes: universal.includeMorphTargets,
          includeMaterials: true,
          includeTextures: universal.includeTextures,
          compressTextures: universal.compressTextures,
          textureQuality: universal.textureQuality,
          optimizeMesh: universal.optimizeMesh,
          mergeMeshes: false,
          removeUnusedBones: universal.removeUnusedBones,
          bakeAnimations: false,
          animationSampleRate: universal.animationSampleRate,
        };

      case 'vrm':
        return {
          ...baseOptions,
          format,
          removeUnnecessaryVertices: true,
          combineSkeletons: true,
          combineMorphs: true,
        };

      case 'fbx':
        return {
          ...baseOptions,
          format,
          includeAnimations: universal.includeAnimations,
          includeTextures: universal.includeTextures,
          textureCompression: universal.compressTextures
            ? this.getTextureQuality(universal.textureQuality)
            : false,
          optimizeMesh: universal.optimizeMesh,
          removeUnusedBones: universal.removeUnusedBones,
        };

      case 'bvh':
        return {
          metadata: baseOptions.metadata,
          animationSampleRate: universal.animationSampleRate || 30,
        };

      case 'vrma':
        return {
          metadata: baseOptions.metadata,
          animationName: universal.name || 'animation',
        };

      default:
        return baseOptions;
    }
  }

  /**
   * Get supported export formats
   */
  getSupportedFormats(): ModelFormat[] {
    return Array.from(this.exporters.keys()) as ModelFormat[];
  }

  /**
   * Check if format is supported for export
   */
  isFormatSupported(format: ModelFormat): boolean {
    return this.exporters.has(format);
  }

  /**
   * Get export options for a format
   */
  getDefaultOptionsForFormat(format: ModelFormat): UniversalExportOptions {
    const baseOptions: UniversalExportOptions = {
      formats: [format],
      quality: 'high',
      includeAnimations: true,
      includeMorphTargets: true,
      includeTextures: true,
      compressTextures: true,
      textureQuality: 80,
      optimizeMesh: true,
      removeUnusedBones: true,
      animationSampleRate: 30,
    };

    // Format-specific defaults
    switch (format) {
      case 'glb':
      case 'gltf':
        return baseOptions;

      case 'vrm':
        return {
          ...baseOptions,
          includeAnimations: false, // VRM typically doesn't include animations
        };

      case 'fbx':
        return {
          ...baseOptions,
          optimizeMesh: true,
        };

      default:
        return baseOptions;
    }
  }

  /**
   * Get texture quality level
   */
  private getTextureQuality(quality: number): boolean {
    return quality > 80;
  }

  /**
   * Get supported formats for model type
   */
  getSupportedFormatsForModel(model: Model): ModelFormat[] {
    const supportedFormats: ModelFormat[] = ['glb', 'gltf'];

    // Add VRM if model has VRM data
    if (model.vrm) {
      supportedFormats.push('vrm');
    }

    // Add FBX if model has FBX metadata
    if (model.fbx) {
      supportedFormats.push('fbx');
    }

    return supportedFormats;
  }

  /**
   * Get supported formats for animation
   */
  getSupportedFormatsForAnimation(): ModelFormat[] {
    return ['bvh', 'vrma', 'fbx', 'glb', 'gltf'];
  }

  /**
   * Dispose all exporters
   */
  dispose(): void {
    this.exporters.forEach((exporter) => {
      if (exporter.dispose) {
        exporter.dispose();
      }
    });
    this.exporters.clear();
  }
}

/**
 * Universal export manager singleton
 */
let universalExportManagerInstance: UniversalExportManager | null = null;

/**
 * Get universal export manager instance
 */
export function getUniversalExportManager(): UniversalExportManager {
  if (!universalExportManagerInstance) {
    universalExportManagerInstance = new UniversalExportManager();
  }
  return universalExportManagerInstance;
}
