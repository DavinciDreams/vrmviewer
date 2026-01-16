/**
 * Export Store
 * Zustand store for export options and state
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

/**
 * Export format
 */
export type ExportFormat = 'gltf' | 'glb' | 'vrm' | 'fbx' | 'bvh';

/**
 * Export quality
 */
export type ExportQuality = 'low' | 'medium' | 'high' | 'ultra';

/**
 * Export options
 */
export interface ExportOptions {
  format: ExportFormat;
  quality: ExportQuality;
  includeAnimations: boolean;
  includeBlendShapes: boolean;
  includeMaterials: boolean;
  includeTextures: boolean;
  compressTextures: boolean;
  textureQuality: number; // 0-100
  optimizeMesh: boolean;
  mergeMeshes: boolean;
  removeUnusedBones: boolean;
  bakeAnimations: boolean;
  animationSampleRate: number; // FPS
}

/**
 * Export state
 */
export interface ExportState {
  // Export options
  options: ExportOptions;

  // Export status
  isExporting: boolean;
  progress: number; // 0-100
  currentStep: string;
  error: string | null;

  // Export result
  exportedFile: File | null;
  exportedUrl: string | null;

  // Actions
  setOptions: (options: Partial<ExportOptions>) => void;
  resetOptions: () => void;
  setExporting: (isExporting: boolean) => void;
  setProgress: (progress: number) => void;
  setCurrentStep: (step: string) => void;
  setError: (error: string | null) => void;
  setExportedFile: (file: File | null) => void;
  setExportedUrl: (url: string | null) => void;
  reset: () => void;
}

/**
 * Default export options
 */
const defaultExportOptions: ExportOptions = {
  format: 'glb',
  quality: 'high',
  includeAnimations: true,
  includeBlendShapes: true,
  includeMaterials: true,
  includeTextures: true,
  compressTextures: true,
  textureQuality: 80,
  optimizeMesh: true,
  mergeMeshes: false,
  removeUnusedBones: true,
  bakeAnimations: false,
  animationSampleRate: 30,
};

/**
 * Create export store
 */
export const useExportStore = create<ExportState>()(
  devtools(
    persist(
      (set) => ({
        // Initial state
        options: defaultExportOptions,
        isExporting: false,
        progress: 0,
        currentStep: '',
        error: null,
        exportedFile: null,
        exportedUrl: null,

        // Actions
        setOptions: (newOptions: Partial<ExportOptions>) =>
          set((state) => ({
            options: { ...state.options, ...newOptions },
          })),

        resetOptions: () =>
          set({
            options: defaultExportOptions,
          }),

        setExporting: (isExporting: boolean) =>
          set({
            isExporting,
            progress: isExporting ? 0 : 0,
            error: null,
          }),

        setProgress: (progress: number) =>
          set({
            progress: Math.max(0, Math.min(100, progress)),
          }),

        setCurrentStep: (step: string) =>
          set({
            currentStep: step,
          }),

        setError: (error: string | null) =>
          set({
            error,
            isExporting: false,
          }),

        setExportedFile: (file: File | null) =>
          set({
            exportedFile: file,
            isExporting: false,
            progress: 100,
          }),

        setExportedUrl: (url: string | null) =>
          set({
            exportedUrl: url,
          }),

        reset: () =>
          set({
            options: defaultExportOptions,
            isExporting: false,
            progress: 0,
            currentStep: '',
            error: null,
            exportedFile: null,
            exportedUrl: null,
          }),
      }),
      {
        name: 'export-storage',
        // Persist export options
        partialize: (state) => ({
          options: state.options,
        }),
      }
    )
  )
);

/**
 * Selectors
 */
export const selectExportOptions = (state: ExportState) => state.options;

export const selectExportStatus = (state: ExportState) => ({
  isExporting: state.isExporting,
  progress: state.progress,
  currentStep: state.currentStep,
  error: state.error,
});

export const selectExportResult = (state: ExportState) => ({
  exportedFile: state.exportedFile,
  exportedUrl: state.exportedUrl,
});

/**
 * Helper functions
 */

/**
 * Get quality settings
 */
export function getQualitySettings(quality: ExportQuality): {
  textureQuality: number;
  meshOptimization: boolean;
} {
  switch (quality) {
    case 'low':
      return {
        textureQuality: 50,
        meshOptimization: true,
      };
    case 'medium':
      return {
        textureQuality: 70,
        meshOptimization: true,
      };
    case 'high':
      return {
        textureQuality: 80,
        meshOptimization: true,
      };
    case 'ultra':
      return {
        textureQuality: 95,
        meshOptimization: false,
      };
    default:
      return {
        textureQuality: 80,
        meshOptimization: true,
      };
  }
}

/**
 * Get format extension
 */
export function getFormatExtension(format: ExportFormat): string {
  switch (format) {
    case 'gltf':
      return '.gltf';
    case 'glb':
      return '.glb';
    case 'vrm':
      return '.vrm';
    case 'fbx':
      return '.fbx';
    case 'bvh':
      return '.bvh';
    default:
      return '.glb';
  }
}

/**
 * Get format mime type
 */
export function getFormatMimeType(format: ExportFormat): string {
  switch (format) {
    case 'gltf':
      return 'model/gltf+json';
    case 'glb':
      return 'model/gltf-binary';
    case 'vrm':
      return 'model/vrm';
    case 'fbx':
      return 'application/octet-stream';
    case 'bvh':
      return 'application/octet-stream';
    default:
      return 'model/gltf-binary';
  }
}
