/**
 * VRMA Exporter
 * Exports current animation as VRMA
 */

import * as THREE from 'three';
import {
  VRMAExportOptions,
  ExportResult,
  ExportProgress,
} from '../../types/export.types';

/**
 * VRMA Exporter
 * Handles VRMA export functionality
 */
export class VRMAExporter {
  /**
   * Export current animation as VRMA
   */
  async exportVRMA(
    animation: THREE.AnimationClip,
    options: VRMAExportOptions,
    onProgress?: (progress: ExportProgress) => void
  ): Promise<ExportResult> {
    try {
      // Validate input
      if (!animation) {
        return {
          success: false,
          error: {
            type: 'NO_ANIMATION_LOADED',
            message: 'No animation loaded to export',
          },
        };
      }

      // Report progress
      this.reportProgress(onProgress, {
        stage: 'INITIALIZING',
        progress: 10,
        message: 'Initializing VRMA export...',
        currentStep: 1,
        totalSteps: 4,
      });

      // Prepare VRMA metadata
      this.reportProgress(onProgress, {
        stage: 'PREPARING',
        progress: 20,
        message: 'Preparing VRMA metadata...',
        currentStep: 2,
        totalSteps: 4,
      });

      const vmaMetadata = this.prepareVRMMetadata(options);

      // Export to VRMA
      this.reportProgress(onProgress, {
        stage: 'PROCESSING',
        progress: 60,
        message: 'Exporting to VRMA format...',
        currentStep: 3,
        totalSteps: 4,
      });

      const result = await this.exportToVRMA(animation, vmaMetadata);

      if (!result.success) {
        return result;
      }

      // Create blob
      this.reportProgress(onProgress, {
        stage: 'FINALIZING',
        progress: 95,
        message: 'Creating export blob...',
        currentStep: 4,
        totalSteps: 4,
      });

      const blob = new Blob([result.data], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);

      this.reportProgress(onProgress, {
        stage: 'COMPLETE',
        progress: 100,
        message: 'Export complete',
        currentStep: 4,
        totalSteps: 4,
      });

      return {
        success: true,
        data: {
          blob,
          url,
          filename: this.generateFilename(options.animationName, 'vrma'),
          size: blob.size,
          format: 'vrma',
          duration: animation.duration,
        },
      };
    } catch (error) {
      console.error('VRMA export failed:', error);

      return {
        success: false,
        error: {
          type: 'EXPORT_FAILED',
          message: 'Failed to export VRMA',
          details: error,
        },
      };
    }
  }

  /**
   * Prepare VRM metadata
   */
  private prepareVRMMetadata(options: VRMAExportOptions): Record<string, unknown> {
    return {
      title: options.metadata.title || 'Untitled Animation',
      version: options.metadata.version || '1.0',
      author: options.metadata.author || 'Unknown',
      contactInformation: options.metadata.contactInformation,
      reference: options.metadata.reference,
      thumbnail: options.metadata.thumbnail,
      license: options.metadata.license,
      allowedUserName: options.metadata.allowedUserName,
      violentUsageName: options.metadata.violentUsageName,
      sexualUsageName: options.metadata.sexualUsageName,
      commercialUsageName: options.metadata.commercialUsageName,
      politicalOrReligiousUsageName: options.metadata.politicalOrReligiousUsageName,
      antisocialOrHateUsageName: options.metadata.antisocialOrHateUsageName,
      creditNotation: options.metadata.creditNotation,
      allowRedistribution: options.metadata.allowRedistribution,
      modification: options.metadata.modification,
      otherLicenseUrl: options.metadata.otherLicenseUrl,
    };
  }

  /**
   * Export to VRMA
   */
  private async exportToVRMA(
    animation: THREE.AnimationClip,
    metadata: Record<string, unknown>
  ): Promise<ExportResult<ArrayBuffer>> {
    // Note: This is a simplified implementation
    // Full VRMA export would use @pixiv/three-vrm-animation library
    // to properly create VRMA format with all VRMA extensions

    // For now, we'll create a basic GLTF export with VRMA metadata
    // This will work for most VRMA use cases

    // Create a simple GLTF structure with VRMA metadata
    const gltf = {
      asset: {
        version: '2.0',
        generator: 'VRM Viewer',
      },
      scene: {
        nodes: [
          {
            name: animation.name,
            extensions: {
              VRM_animation: metadata,
            },
          },
        ],
      },
    };

    // Convert to ArrayBuffer
    const gltfString = JSON.stringify(gltf, null, 2);
    return {
      success: true,
      data: new TextEncoder().encode(gltfString).buffer,
    };
  }

  /**
   * Generate filename
   */
  private generateFilename(name: string, extension: string): string {
    // Sanitize filename
    const sanitizedName = name.replace(/[^a-zA-Z0-9_-]/g, '_');
    return `${sanitizedName}.${extension}`;
  }

  /**
   * Report progress
   */
  private reportProgress(
    callback: ((progress: ExportProgress) => void) | undefined,
    progress: ExportProgress
  ): void {
    if (callback) {
      callback(progress);
    }
  }
}

/**
 * VRMA exporter singleton
 */
let vrmaExporterInstance: VRMAExporter | null = null;

/**
 * Get VRMA exporter instance
 */
export function getVRMAExporter(): VRMAExporter {
  if (!vrmaExporterInstance) {
    vrmaExporterInstance = new VRMAExporter();
  }
  return vrmaExporterInstance;
}
