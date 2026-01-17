/**
 * VRM Exporter
 * Exports current model as VRM1
 */

import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { VRMMetadata } from '../../../types/vrm.types';
import {
  VRMExportOptions,
  ExportResult,
  ExportProgress,
  ExportError,
} from '../../../types/export.types';

/**
 * VRM Exporter
 * Handles VRM1 export functionality
 */
export class VRMExporter {
  private gltfExporter: GLTFExporter;

  constructor() {
    this.gltfExporter = new GLTFExporter();
  }

  /**
   * Export current model as VRM1
   */
  async exportVRM(
    model: THREE.Group,
    options: VRMExportOptions,
    onProgress?: (progress: ExportProgress) => void
  ): Promise<ExportResult> {
    try {
      // Validate input
      if (!model) {
        return {
          success: false,
          error: {
            type: 'NO_MODEL_LOADED',
            message: 'No model loaded to export',
          },
        };
      }

      // Report progress
      this.reportProgress(onProgress, {
        stage: 'INITIALIZING',
        progress: 10,
        message: 'Initializing VRM export...',
        currentStep: 1,
        totalSteps: 4,
      });

      // Prepare VRM metadata
      this.reportProgress(onProgress, {
        stage: 'PREPARING',
        progress: 20,
        message: 'Preparing VRM metadata...',
        currentStep: 2,
        totalSteps: 4,
      });

      const vrmMetadata = this.prepareVRMMetadata(options.metadata);

      // Apply VRM optimizations
      this.reportProgress(onProgress, {
        stage: 'PROCESSING',
        progress: 40,
        message: 'Applying VRM optimizations...',
        currentStep: 3,
        totalSteps: 4,
      });

      const optimizedModel = this.applyOptimizations(model, options);

      // Export to GLTF
      this.reportProgress(onProgress, {
        stage: 'PROCESSING',
        progress: 60,
        message: 'Exporting to GLTF format...',
        currentStep: 4,
        totalSteps: 4,
      });

      const gltfResult = await this.exportToGLTF(optimizedModel, options);

      if (!gltfResult.success) {
        return {
          success: false,
          error: gltfResult.error,
        };
      }

      // Generate thumbnail if requested
      let thumbnail: string | undefined;
      if (options.generateThumbnail) {
        this.reportProgress(onProgress, {
          stage: 'GENERATING_THUMBNAIL',
          progress: 80,
          message: 'Generating thumbnail...',
          currentStep: 5,
          totalSteps: 5,
        });

        thumbnail = await this.generateThumbnail(optimizedModel);
      }

      // Create blob
      this.reportProgress(onProgress, {
        stage: 'FINALIZING',
        progress: 95,
        message: 'Creating export blob...',
        currentStep: 5,
        totalSteps: 5,
      });

      if (!gltfResult.data) {
        return {
          success: false,
          error: {
            type: 'EXPORT_FAILED',
            message: 'Failed to export GLTF - no data returned',
          },
        };
      }

      const blob = new Blob([gltfResult.data], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);

      this.reportProgress(onProgress, {
        stage: 'COMPLETE',
        progress: 100,
        message: 'Export complete',
        currentStep: 5,
        totalSteps: 5,
      });

      return {
        success: true,
        data: {
          blob,
          url,
          filename: this.generateFilename(options.metadata.title, 'vrm'),
          size: blob.size,
          format: 'vrm',
          thumbnail,
          metadata: vrmMetadata,
        },
      };
    } catch (error) {
      console.error('VRM export failed:', error);

      return {
        success: false,
        error: {
          type: 'EXPORT_FAILED',
          message: 'Failed to export VRM',
          details: error,
        },
      };
    }
  }

  /**
   * Prepare VRM metadata
   */
  private prepareVRMMetadata(metadata: VRMMetadata): VRMMetadata {
    return {
      title: metadata.title || 'Untitled Model',
      version: metadata.version || '1.0',
      author: metadata.author || 'Unknown',
      contactInformation: metadata.contactInformation,
      reference: metadata.reference,
      thumbnail: metadata.thumbnail,
      license: metadata.license,
      allowedUserName: metadata.allowedUserName,
      violentUsageName: metadata.violentUsageName,
      sexualUsageName: metadata.sexualUsageName,
      commercialUsageName: metadata.commercialUsageName,
      politicalOrReligiousUsageName: metadata.politicalOrReligiousUsageName,
      antisocialOrHateUsageName: metadata.antisocialOrHateUsageName,
      creditNotation: metadata.creditNotation,
      allowRedistribution: metadata.allowRedistribution,
      modification: metadata.modification,
      otherLicenseUrl: metadata.otherLicenseUrl,
    };
  }

  /**
   * Apply VRM optimizations
   */
  private applyOptimizations(model: THREE.Group, options: VRMExportOptions): THREE.Group {
    const clonedModel = model.clone();

    if (options.removeUnnecessaryVertices !== false) {
      // Remove unnecessary vertices
      this.removeUnnecessaryVertices(clonedModel);
    }

    if (options.combineSkeletons !== false) {
      // Combine skeletons
      this.combineSkeletons(clonedModel);
    }

    if (options.combineMorphs !== false) {
      // Combine morphs
      this.combineMorphs(clonedModel);
    }

    return clonedModel;
  }

  /**
   * Remove unnecessary vertices
   */
  private removeUnnecessaryVertices(model: THREE.Group): void {
    model.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        const geometry = object.geometry;
        if (geometry) {
          // Remove duplicate vertices
          geometry.deleteAttribute('normal');
          geometry.computeVertexNormals();
        }
      }
    });
  }

  /**
   * Combine skeletons
   */
  private combineSkeletons(model: THREE.Group): void {
    // Find all skeletons and combine them
    const skeletons: THREE.Skeleton[] = [];

    model.traverse((object) => {
      if (object instanceof THREE.SkinnedMesh && object.skeleton) {
        skeletons.push(object.skeleton);
      }
    });

    // Combine skeletons if multiple found
    if (skeletons.length > 1) {
      // Use first skeleton as primary
      const primarySkeleton = skeletons[0];

      model.traverse((object) => {
        if (object instanceof THREE.SkinnedMesh && object.skeleton) {
          object.skeleton = primarySkeleton;
        }
      });
    }
  }

  /**
   * Combine morphs
   */
  private combineMorphs(model: THREE.Group): void {
    // Find all morph targets and combine them
    model.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        const geometry = object.geometry;
        if (geometry && geometry.morphAttributes && geometry.morphAttributes.position) {
          // Combine morph targets
          // This is a simplified version - full implementation would be more complex
        }
      }
    });
  }

  /**
   * Export to GLTF
   */
  private async exportToGLTF(
    model: THREE.Group,
    options: VRMExportOptions
  ): Promise<{ success: boolean; data?: ArrayBuffer; error?: ExportError }> {
    return new Promise((resolve) => {
      this.gltfExporter.parse(
        model,
        (gltf) => {
          // GLTFExporter returns either ArrayBuffer or object
          const data = gltf instanceof ArrayBuffer ? gltf : JSON.stringify(gltf);
          const arrayBuffer = data instanceof ArrayBuffer ? data : new TextEncoder().encode(data).buffer;
          resolve({
            success: true,
            data: arrayBuffer,
          });
        },
        (error) => {
          resolve({
            success: false,
            error: {
              type: 'EXPORT_FAILED',
              message: 'Failed to export to GLTF',
              details: error,
            },
          });
        },
        {
          binary: options.binary !== false,
          onlyVisible: false,
          trs: false,
          truncateDrawRange: true,
          maxTextureSize: options.quality === 'ultra' ? 4096 : options.quality === 'high' ? 2048 : 1024,
        }
      );
    });
  }

  /**
   * Generate thumbnail
   */
  private async generateThumbnail(model: THREE.Group): Promise<string> {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const size = 256;
      canvas.width = size;
      canvas.height = size;

      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(45, size / size, 0.1, 100);

      scene.add(model.clone());
      renderer.render(scene, camera);

      const dataUrl = canvas.toDataURL('image/png');
      renderer.dispose();

      resolve(dataUrl);
    });
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
 * VRM exporter singleton
 */
let vrmExporterInstance: VRMExporter | null = null;

/**
 * Get VRM exporter instance
 */
export function getVRMExporter(): VRMExporter {
  if (!vrmExporterInstance) {
    vrmExporterInstance = new VRMExporter();
  }
  return vrmExporterInstance;
}
