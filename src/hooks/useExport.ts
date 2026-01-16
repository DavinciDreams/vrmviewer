/**
 * useExport Hook
 * Provides export functionality for components
 */

import { useState, useCallback } from 'react';
import { getVRMExporter } from '../core/three/export/VRMExporter';
import { getVRMAExporter } from '../core/three/export/VRMAExporter';
import {
  ExportResult,
  ExportProgress,
} from '../types/export.types';
import { downloadFile } from '../utils/exportUtils';

/**
 * Export Hook
 * Manages export operations and state
 */
export function useExport() {
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);
  const [exportResult, setExportResult] = useState<ExportResult | null>(null);
  const [exportOptions, setExportOptions] = useState({
    format: 'vrm',
    quality: 'medium',
    compression: 'none',
    binary: true,
    pretty: false,
    generateThumbnail: false,
    includeAnimations: true,
    includeBlendShapes: true,
    includeMaterials: true,
    includeTextures: true,
    metadata: {
      title: 'Untitled',
      version: '1.0',
      author: '',
    },
  });

  const vrmExporter = getVRMExporter();
  const vrmaExporter = getVRMAExporter();

  /**
   * Export model as VRM
   */
  const exportVRM = async (model: THREE.Group, options?: Record<string, unknown>) => {
    setIsExporting(true);
    setExportProgress({
      stage: 'INITIALIZING',
      progress: 10,
      message: 'Initializing VRM export...',
      currentStep: 1,
      totalSteps: 5,
    });

    const fullOptions = {
      ...exportOptions,
      format: 'vrm',
    };

    const result = await vrmExporter.exportVRM(model, fullOptions, (progress) => {
      setExportProgress(progress);
    });

    setExportProgress(null);
    setIsExporting(false);
    setExportResult(result);

    if (result.success && result.data) {
      downloadFile(result.data.blob, result.data.filename);
    }

    return result;
  };

  /**
   * Export animation as VRMA
   */
  const exportVRMA = async (animation: THREE.AnimationClip, options?: Record<string, unknown>) => {
    setIsExporting(true);
    setExportProgress({
      stage: 'INITIALIZING',
      progress: 10,
      message: 'Initializing VRMA export...',
      currentStep: 1,
      totalSteps: 4,
    });

    const fullOptions = {
      ...exportOptions,
      format: 'vrma',
      animationName: options?.metadata?.title || 'Untitled Animation',
    };

    const result = await vrmaExporter.exportVRMA(animation, fullOptions, (progress) => {
      setExportProgress(progress);
    });

    setExportProgress(null);
    setIsExporting(false);
    setExportResult(result);

    if (result.success && result.data) {
      downloadFile(result.data.blob, result.data.filename);
    }

    return result;
  };

  /**
   * Cancel export
   */
  const cancelExport = () => {
    setIsExporting(false);
    setExportProgress(null);
    setExportResult(null);
  };

  /**
   * Reset export state
   */
  const resetExport = () => {
    setIsExporting(false);
    setExportProgress(null);
    setExportResult(null);
  };

  /**
   * Update export options
   */
  const updateExportOptions = (options: Record<string, unknown>) => {
    setExportOptions((prev) => ({ ...prev, ...options }));
  };

  /**
   * Update metadata
   */
  const updateMetadata = (metadata: Record<string, unknown>) => {
    setExportOptions((prev) => ({
      ...prev,
      metadata: { ...prev.metadata, ...metadata },
    }));
  };

  return {
    isExporting,
    exportProgress,
    exportResult,
    exportOptions,
    exportVRM,
    exportVRMA,
    cancelExport,
    resetExport,
    updateExportOptions,
    updateMetadata,
  };
}
