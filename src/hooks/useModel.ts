/**
 * useModel Hook
 * Format-agnostic hook for model loading and management
 * Replaces VRM-centric useVRM hook
 */

import { useCallback } from 'react';
import * as THREE from 'three';
import { gltfLoaderEnhanced } from '../core/three/loaders/GLTFLoaderEnhanced';
import { vrmLoader } from '../core/three/loaders/VRMLoader';
import { fbxLoader } from '../core/three/loaders/FBXLoader';
import { useModelStore } from '../store/modelStore';
import {
  Model,
  ModelFormat,
} from '../types/model.types';
import { validateModelFile } from '../utils/fileUtils';

/**
 * useModel Hook
 * Format-agnostic hook for loading and managing 3D models
 * Supports: GLB, GLTF, VRM, FBX, and more
 */
export function useModel() {
  const {
    currentModel,
    isLoading,
    error,
    metadata,
    setModel,
    setLoading,
    setError,
    clearError,
    setMetadata,
    clearModel: clearStoreModel,
  } = useModelStore();

  /**
   * Load model from URL
   */
  const loadFromURL = useCallback(async (url: string): Promise<Model | null> => {
    setLoading(true);
    clearError();
    clearStoreModel();

    try {
      // Detect format from URL
      const format = detectFormatFromURL(url);
      const loader = getLoaderForFormat(format);

      const result = await loader.loadFromURL(url);

      if (result.success && result.data) {
        // Cast to Model for now - loaders will be updated to return Model interface
        const model = result.data as unknown as Model;
        setModel(model);
        setMetadata(extractMetadata(model));
        return model;
      } else {
        setError(result.error?.message || 'Failed to load model');
        return null;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      return null;
    } finally {
      setLoading(false);
    }
  }, [setModel, setLoading, setError, clearError, clearStoreModel, setMetadata]);

  /**
   * Load model from File
   */
  const loadFromFile = useCallback(async (file: File): Promise<Model | null> => {
    setLoading(true);
    clearError();
    clearStoreModel();

    try {
      const validation = validateModelFile(file);

      if (!validation.valid) {
        setError(validation.error || 'Invalid file');
        setLoading(false);
        return null;
      }

      // Detect format from file extension
      const format = detectFormatFromFilename(file.name);
      const loader = getLoaderForFormat(format);

      const result = await loader.loadFromFile(file);

      if (result.success && result.data) {
        // Cast to Model for now - loaders will be updated to return Model interface
        const model = result.data as unknown as Model;
        setModel(model);
        setMetadata(extractMetadata(model));
        return model;
      } else {
        setError(result.error?.message || 'Failed to load model');
        return null;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      return null;
    } finally {
      setLoading(false);
    }
  }, [setModel, setLoading, setError, clearError, clearStoreModel, setMetadata]);

  /**
   * Alias for loadFromFile (for backward compatibility)
   */
  const loadModelFromFile = loadFromFile;

  /**
   * Clear current model
   */
  const clearCurrentModel = useCallback(() => {
    clearStoreModel();
  }, [clearStoreModel]);

  /**
   * Get format helpers
   */
  const format = currentModel?.format;
  const isVRM = currentModel?.format === 'vrm';
  const isGLB = currentModel?.format === 'glb';
  const isGLTF = currentModel?.format === 'gltf';
  const isFBX = currentModel?.format === 'fbx';
  const hasSkeleton = !!currentModel?.skeleton;
  const hasMorphTargets = !!currentModel?.morphTargets && currentModel.morphTargets.size > 0;
  const hasAnimations = !!currentModel?.animations && currentModel.animations.length > 0;

  return {
    // Core state
    currentModel,
    isLoading,
    error,
    metadata,

    // Loading methods
    loadFromURL,
    loadFromFile,
    loadModelFromFile,
    clearCurrentModel,

    // Format helpers
    format,
    isVRM,
    isGLB,
    isGLTF,
    isFBX,
    hasSkeleton,
    hasMorphTargets,
    hasAnimations,

    // Raw store methods (for advanced usage)
    setModel,
    setLoading,
    setError,
    clearError,
    setMetadata,
    clearModel: clearStoreModel,
  };
}

/**
 * Detect format from URL
 */
function detectFormatFromURL(url: string): ModelFormat {
  const extension = url.split('.').pop()?.toLowerCase();

  switch (extension) {
    case 'glb':
      return 'glb';
    case 'gltf':
      return 'gltf';
    case 'vrm':
      return 'vrm';
    case 'fbx':
      return 'fbx';
    case 'pmx':
      return 'pmx';
    case 'obj':
      return 'obj';
    default:
      return 'glb'; // Default to GLB
  }
}

/**
 * Detect format from filename
 */
function detectFormatFromFilename(filename: string): ModelFormat {
  return detectFormatFromURL(filename);
}

/**
 * Get appropriate loader for format
 */
function getLoaderForFormat(format: ModelFormat) {
  switch (format) {
    case 'glb':
    case 'gltf':
      return gltfLoaderEnhanced; // Enhanced loader
    case 'vrm':
      return vrmLoader;
    case 'fbx':
      return fbxLoader;
    default:
      return gltfLoaderEnhanced; // Default to GLTF loader
  }
}

/**
 * Extract metadata from model
 * Returns format compatible with store's metadata type
 */
function extractMetadata(model: Model): {
  name: string;
  version: string;
  author: string;
  format?: string;
} {
  return {
    name: model.metadata.name || 'Unknown Model',
    version: model.metadata.version || '1.0',
    author: model.metadata.author || 'Unknown',
    format: model.format,
  };
}

/**
 * Type guard for VRM models
 */
export function isVRMModel(model: Model): model is Model & { vrm: any } {
  return model.format === 'vrm' && !!model.vrm;
}

/**
 * Type guard for models with skeleton
 */
export function hasModelSkeleton(model: Model): model is Model & { skeleton: THREE.Skeleton } {
  return !!model.skeleton;
}

/**
 * Type guard for models with morph targets
 */
export function hasModelMorphTargets(model: Model): model is Model & { morphTargets: Map<string, any> } {
  return !!model.morphTargets && model.morphTargets.size > 0;
}

/**
 * Type guard for models with animations
 */
export function hasModelAnimations(model: Model): model is Model & { animations: THREE.AnimationClip[] } {
  return !!model.animations && model.animations.length > 0;
}
