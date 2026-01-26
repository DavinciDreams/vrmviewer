/**
 * FBX Exporter
 * Exports models to FBX format
 *
 * NOTE: Three.js does not include a built-in FBX exporter.
 * This is a placeholder implementation. To enable FBX export:
 *
 * Options:
 * 1. Use a third-party library (e.g., fbx-writer)
 * 2. Implement FBX serialization manually
 * 3. Use a server-side conversion service
 *
 * For now, this returns an error indicating the limitation.
 */

import * as THREE from 'three';
import {
  ExportOptions,
  ExportResult,
  ExportProgress,
} from '../../../types/export.types';

/**
 * FBX Exporter
 * Handles FBX export with animations and morph targets
 *
 * NOTE: FBX export is not currently supported.
 * This is a placeholder for future implementation.
 */
export class FBXExporter {
  constructor() {
    // Placeholder: FBX serializer would be initialized here if available
  }

  /**
   * Export model to FBX
   *
   * NOTE: FBX export is not currently supported.
   * Three.js does not include a built-in FBX serializer.
   * To enable FBX export, integrate a third-party library or service.
   */
  async exportFBX(
    _model: THREE.Group,
    _options: ExportOptions,
    _onProgress?: (progress: ExportProgress) => void
  ): Promise<ExportResult> {
    // Return error indicating FBX export is not supported
    return {
      success: false,
      error: {
        type: 'UNSUPPORTED_FORMAT',
        message: 'FBX export is not currently supported. Three.js does not include a built-in FBX serializer. To enable FBX export, integrate a third-party library such as fbx-writer or use a server-side conversion service.',
      },
    };
  }

  /**
   * Dispose exporter
   */
  dispose(): void {
    // Nothing to dispose
  }
}

/**
 * FBX exporter singleton
 */
let fbxExporterInstance: FBXExporter | null = null;

/**
 * Get FBX exporter instance
 */
export function getFBXExporter(): FBXExporter {
  if (!fbxExporterInstance) {
    fbxExporterInstance = new FBXExporter();
  }
  return fbxExporterInstance;
}
