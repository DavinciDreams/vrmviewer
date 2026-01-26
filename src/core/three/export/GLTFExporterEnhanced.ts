/**
 * GLB/GLTF Exporter
 * Primary exporter for GLB/GLTF format (universal 3D format)
 */

import * as THREE from 'three';
import { GLTFExporter as ThreeGLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import {
  ExportOptions,
  ExportResult,
  ExportProgress,
  ExportError,
  ExportFormat,
} from '../../../types/export.types';

/**
 * GLB/GLTF Exporter
 * Handles GLB (binary) and GLTF (JSON) export
 */
export class GLTFExporterEnhanced {
  private gltfExporter: any;

  constructor() {
    this.gltfExporter = new ThreeGLTFExporter();
  }

  /**
   * Export model to GLB or GLTF
   */
  async exportGLTF(
    model: THREE.Group,
    options: ExportOptions,
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

      this.reportProgress(onProgress, {
        stage: 'INITIALIZING',
        progress: 10,
        message: 'Initializing GLTF export...',
        currentStep: 1,
        totalSteps: 3,
      });

      // Clone model to avoid modifying original
      const exportModel = this.cloneModel(model);

      this.reportProgress(onProgress, {
        stage: 'PROCESSING',
        progress: 30,
        message: 'Processing model for export...',
        currentStep: 2,
        totalSteps: 3,
      });

      // Apply optimizations if requested
      const optimizedModel = this.applyOptimizations(exportModel, options);

      this.reportProgress(onProgress, {
        stage: 'EXPORTING',
        progress: 60,
        message: 'Exporting to GLTF format...',
        currentStep: 3,
        totalSteps: 3,
      });

      // Export using Three.js GLTFExporter
      const result = await this.exportWithThreeJS(optimizedModel, options);

      if (!result.success || !result.data) {
        return {
          success: false,
          error: result.error || {
            type: 'EXPORT_FAILED',
            message: 'Failed to export GLTF - no data returned',
          },
        };
      }

      // Create blob
      const isBinary = options.format === 'glb';
      const mimeType = isBinary ? 'model/gltf-binary' : 'model/gltf+json';
      const blob = new Blob([result.data], { type: mimeType });
      const url = URL.createObjectURL(blob);

      this.reportProgress(onProgress, {
        stage: 'COMPLETE',
        progress: 100,
        message: 'Export complete',
        currentStep: 3,
        totalSteps: 3,
      });

      return {
        success: true,
        data: {
          blob,
          url,
          filename: this.generateFilename('model', options.format),
          size: blob.size,
          format: options.format,
        },
      };
    } catch (error) {
      console.error('GLTF export failed:', error);

      return {
        success: false,
        error: {
          type: 'EXPORT_FAILED',
          message: 'Failed to export GLTF',
          details: error,
        },
      };
    }
  }

  /**
   * Clone model for export
   */
  private cloneModel(model: THREE.Group): THREE.Group {
    return model.clone(true);
  }

  /**
   * Apply export optimizations
   */
  private applyOptimizations(model: THREE.Group, options: ExportOptions): THREE.Group {
    const optimizedModel = model.clone(true);

    // Optimize meshes
    if (options.optimizeMesh) {
      this.optimizeMeshes(optimizedModel);
    }

    // Merge meshes if requested
    if (options.mergeMeshes) {
      this.mergeMeshes(optimizedModel);
    }

    // Remove unused bones
    if (options.removeUnusedBones) {
      this.removeUnusedBones(optimizedModel);
    }

    return optimizedModel;
  }

  /**
   * Optimize meshes
   */
  private optimizeMeshes(model: THREE.Group): void {
    model.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        const mesh = object as THREE.Mesh;
        const geometry = mesh.geometry;

        if (geometry) {
          // Compute vertex normals if missing
          if (!geometry.attributes.normal) {
            geometry.computeVertexNormals();
          }

          // Remove unused attributes
          if (geometry.attributes.color && !this.hasVertexColors(geometry)) {
            geometry.deleteAttribute('color');
          }
        }
      }
    });
  }

  /**
   * Check if geometry has vertex colors
   */
  private hasVertexColors(geometry: THREE.BufferGeometry): boolean {
    if (geometry.attributes.color) {
      const colors = geometry.attributes.color;
      // Check if any color is not white (1, 1, 1)
      for (let i = 0; i < colors.count; i++) {
        const r = colors.getX(i);
        const g = colors.getY(i);
        const b = colors.getZ(i);
        if (r !== 1 || g !== 1 || b !== 1) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Merge meshes with same materials
   */
  private mergeMeshes(model: THREE.Group): void {
    // Group meshes by material
    const meshesByMaterial = new Map<string, THREE.Mesh[]>();

    model.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        const mesh = object as THREE.Mesh;
        const materialId = this.getMaterialId(mesh.material);

        if (!meshesByMaterial.has(materialId)) {
          meshesByMaterial.set(materialId, []);
        }

        meshesByMaterial.get(materialId)!.push(mesh);
      }
    });

    // Merge meshes with same material
    // This is a simplified implementation
    // A full implementation would use BufferGeometryUtils.mergeGeometries
  }

  /**
   * Get material ID
   */
  private getMaterialId(material: THREE.Material | THREE.Material[]): string {
    if (Array.isArray(material)) {
      return material.map((m) => m.uuid).join('-');
    }
    return material.uuid;
  }

  /**
   * Remove unused bones
   */
  private removeUnusedBones(model: THREE.Group): void {
    const usedBones = new Set<string>();

    // Find all bones used by skinned meshes
    model.traverse((object) => {
      if (object instanceof THREE.SkinnedMesh && object.skeleton) {
        object.skeleton.bones.forEach((bone) => {
          usedBones.add(bone.uuid);
        });
      }
    });

    // Remove unused bones
    model.traverse((object) => {
      if (object instanceof THREE.Bone && !usedBones.has(object.uuid)) {
        object.parent?.remove(object);
      }
    });
  }

  /**
   * Export with Three.js GLTFExporter
   */
  private async exportWithThreeJS(
    model: THREE.Group,
    options: ExportOptions
  ): Promise<{ success: boolean; data?: ArrayBuffer; error?: ExportError }> {
    return new Promise((resolve, reject) => {
      this.gltfExporter.parse(
        model,
        (gltf: any) => {
          // GLTFExporter returns either ArrayBuffer or object
          const data = gltf instanceof ArrayBuffer ? gltf : JSON.stringify(gltf);
          const arrayBuffer = data instanceof ArrayBuffer ? data : new TextEncoder().encode(data).buffer;
          resolve({
            success: true,
            data: arrayBuffer,
          });
        },
        (error: unknown) => {
          reject(error);
        },
        {
          binary: options.format === 'glb',
          onlyVisible: false,
          trs: false,
          truncateDrawRange: true,
          maxTextureSize: this.getTextureSize(options.quality),
          animations: options.includeAnimations ? this.extractAnimations(model) : undefined,
        }
      );
    });
  }

  /**
   * Get texture size based on quality
   */
  private getTextureSize(quality: 'low' | 'medium' | 'high' | 'ultra'): number {
    switch (quality) {
      case 'low':
        return 512;
      case 'medium':
        return 1024;
      case 'high':
        return 2048;
      case 'ultra':
        return 4096;
      default:
        return 2048;
    }
  }

  /**
   * Extract animations from model
   */
  private extractAnimations(model: THREE.Group): THREE.AnimationClip[] {
    const animations: THREE.AnimationClip[] = [];

    model.traverse((object) => {
      if (object instanceof THREE.Group && object.animations) {
        animations.push(...object.animations);
      }
    });

    return animations;
  }

  /**
   * Generate filename
   */
  private generateFilename(name: string, format: ExportFormat): string {
    const sanitizedName = name.replace(/[^a-zA-Z0-9_-]/g, '_');
    const extension = format === 'glb' ? 'glb' : 'gltf';
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

  /**
   * Dispose exporter
   */
  dispose(): void {
    // GLTFExporter will be garbage collected
  }
}

/**
 * GLTF exporter singleton
 */
let gltfExporterInstance: GLTFExporterEnhanced | null = null;

/**
 * Get GLTF exporter instance
 */
export function getGLTFExporterEnhanced(): GLTFExporterEnhanced {
  if (!gltfExporterInstance) {
    gltfExporterInstance = new GLTFExporterEnhanced();
  }
  return gltfExporterInstance;
}
