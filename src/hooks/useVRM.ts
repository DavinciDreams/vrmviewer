/**
 * useVRM Hook
 * Custom hook for VRM model loading and management
 * Simplified for single model mode
 */

import { useCallback } from 'react';
import * as THREE from 'three';
import { loaderManager } from '../core/three/loaders/LoaderManager';
import { useVRMStore, type VRMModelEntry } from '../store/vrmStore';
import { vrmLoader } from '../core/three/loaders/VRMLoader';
import { validateModelFile } from '../utils/fileUtils';
import { VRMModel } from '../types/vrm.types';

/**
 * useVRM Hook
 */
export function useVRM() {
  const {
    currentModel,
    isLoading,
    error,
    setModel,
    clearModel: clearStoreModel,
    setModelVisibility,
    setModelWireframe,
    setModelPosition,
    setModelScale,
    setLoading,
    setError,
    clearError,
    setName,
    setDescription,
  } = useVRMStore();

  /**
   * Create a VRM model entry from a VRM model
   */
  const createModelEntry = useCallback((vrmModel: VRMModel, fileName?: string): VRMModelEntry => {
    return {
      id: crypto.randomUUID(),
      model: vrmModel,
      position: new THREE.Vector3(0, 0, 0),
      isVisible: true,
      isWireframe: false,
      scale: 1,
      loadedAt: Date.now(),
    };
  }, []);

  /**
   * Load VRM from URL
   */
  const loadFromURL = useCallback(async (url: string): Promise<boolean> => {
    setLoading(true);
    clearError();

    try {
      const result = await vrmLoader.loadFromURL(url);

      if (result.success && result.data) {
        const entry = createModelEntry(result.data);
        setModel(entry);
        setName(result.data.metadata.title || 'Untitled Model');
        setDescription(result.data.metadata.author || '');
        return true;
      } else {
        setError(result.error?.message || 'Failed to load VRM model');
        return false;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      return false;
    } finally {
      setLoading(false);
    }
  }, [createModelEntry, setModel, setLoading, setError, clearError, setName, setDescription]);

  /**
   * Load VRM from File
   */
  const loadFromFile = useCallback(async (file: File): Promise<boolean> => {
    setLoading(true);
    clearError();

    try {
      const validation = validateModelFile(file);
      
      if (!validation.valid) {
        setError(validation.error || 'Invalid file');
        setLoading(false);
        return false;
      }

      const result = await loaderManager.loadFromFile(file);

      if (result.success && result.data) {
        // For VRM files, use vrmLoader directly to get full VRM structure
        if (result.data.metadata?.format === 'vrm') {
          const vrmResult = await vrmLoader.loadFromFile(file);
          if (vrmResult.success && vrmResult.data) {
            const entry = createModelEntry(vrmResult.data);
            setModel(entry);
            setName(vrmResult.data.metadata.title || file.name);
            setDescription(vrmResult.data.metadata.author || '');
            return true;
          } else {
            setError(vrmResult.error?.message || 'Failed to load VRM model');
            return false;
          }
        } else {
          // For other formats, create a VRM-like structure
          const vrmLikeModel: VRMModel = {
            vrm: undefined as never,
            metadata: {
              title: result.data.metadata?.name || file.name,
              version: '1.0',
              author: 'Unknown',
            },
            expressions: new Map(),
            humanoid: {
              humanBones: [],
            },
            firstPerson: undefined,
            scene: result.data.model as THREE.Group,
            skeleton: undefined as never,
          };
          
          const entry = createModelEntry(vrmLikeModel);
          setModel(entry);
          setName(result.data.metadata?.name || file.name);
          setDescription('Unknown');
          return true;
        }
      } else {
        setError(result.error?.message || 'Failed to load model');
        return false;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      return false;
    } finally {
      setLoading(false);
    }
  }, [createModelEntry, setModel, setLoading, setError, clearError, setName, setDescription]);

  /**
   * Load model from any supported file format
   */
  const loadModelFromFile = useCallback(async (file: File): Promise<VRMModel | null> => {
    setLoading(true);
    clearError();

    try {
      const validation = validateModelFile(file);
      
      if (!validation.valid) {
        setError(validation.error || 'Invalid file');
        setLoading(false);
        return null;
      }

      const result = await loaderManager.loadFromFile(file);

      if (result.success && result.data) {
        // For VRM files, use vrmLoader directly to get full VRM structure
        if (result.data.metadata?.format === 'vrm') {
          const vrmResult = await vrmLoader.loadFromFile(file);
          if (vrmResult.success && vrmResult.data) {
            const entry = createModelEntry(vrmResult.data);
            setModel(entry);
            setName(vrmResult.data.metadata.title || file.name);
            setDescription(vrmResult.data.metadata.author || '');
            return vrmResult.data;
          } else {
            setError(vrmResult.error?.message || 'Failed to load VRM model');
            return null;
          }
        } else {
          // For other formats (GLB, GLTF, FBX), create a VRM-like structure
          const vrmLikeModel: VRMModel = {
            vrm: undefined as never,
            metadata: {
              title: result.data.metadata?.name || file.name,
              version: '1.0',
              author: 'Unknown',
            },
            expressions: new Map(),
            humanoid: {
              humanBones: [],
            },
            firstPerson: undefined,
            scene: result.data.model as THREE.Group,
            skeleton: undefined as never,
          };
          
          const entry = createModelEntry(vrmLikeModel);
          setModel(entry);
          setName(result.data.metadata?.name || file.name);
          setDescription('Unknown');
          
          return vrmLikeModel;
        }
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
  }, [createModelEntry, setModel, setLoading, setError, clearError, setName, setDescription]);

  /**
   * Load model with specific ID (for compatibility, uses simplified single model mode)
   */
  const loadModelWithId = useCallback(async (file: File, _id: string): Promise<boolean> => {
    setLoading(true);
    clearError();

    try {
      const validation = validateModelFile(file);
      
      if (!validation.valid) {
        setError(validation.error || 'Invalid file');
        setLoading(false);
        return false;
      }

      const result = await loaderManager.loadFromFile(file);

      if (result.success && result.data) {
        // For VRM files, use vrmLoader directly to get full VRM structure
        if (result.data.metadata?.format === 'vrm') {
          const vrmResult = await vrmLoader.loadFromFile(file);
          if (vrmResult.success && vrmResult.data) {
            const entry = createModelEntry(vrmResult.data);
            setModel(entry);
            setName(vrmResult.data.metadata.title || file.name);
            setDescription(vrmResult.data.metadata.author || '');
            return true;
          } else {
            setError(vrmResult.error?.message || 'Failed to load VRM model');
            return false;
          }
        } else {
          // For other formats (GLB, GLTF, FBX), create a VRM-like structure
          const vrmLikeModel: VRMModel = {
            vrm: undefined as never,
            metadata: {
              title: result.data.metadata?.name || file.name,
              version: '1.0',
              author: 'Unknown',
            },
            expressions: new Map(),
            humanoid: {
              humanBones: [],
            },
            firstPerson: undefined,
            scene: result.data.model as THREE.Group,
            skeleton: undefined as never,
          };
          
          const entry = createModelEntry(vrmLikeModel);
          setModel(entry);
          setName(result.data.metadata?.name || file.name);
          setDescription('Unknown');
          return true;
        }
      } else {
        setError(result.error?.message || 'Failed to load model');
        return false;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      return false;
    } finally {
      setLoading(false);
    }
  }, [createModelEntry, setModel, setLoading, setError, clearError, setName, setDescription]);

  /**
   * Clear current model
   */
  const clearCurrentModel = useCallback(() => {
    clearStoreModel();
  }, [clearStoreModel]);

  return {
    currentModel,
    isLoading,
    error,
    loadFromURL,
    loadFromFile,
    loadModelFromFile,
    loadModelWithId,
    clearCurrentModel,
    clearError,
    setModelVisibility,
    setModelWireframe,
    setModelPosition,
    setModelScale,
  };
}
