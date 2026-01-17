/**
 * useVRM Hook
 * Custom hook for VRM model loading and management
 */

import { useCallback } from 'react';
import * as THREE from 'three';
import { loaderManager } from '../core/three/loaders/LoaderManager';
import { useVRMStore } from '../store/vrmStore';
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
    metadata,
    setModel,
    setLoading,
    setError,
    clearError,
    setMetadata,
    clearModel: clearStoreModel,
  } = useVRMStore();

  /**
   * Load VRM from URL
   */
  const loadFromURL = useCallback(async (url: string) => {
    setLoading(true);
    clearError();
    clearStoreModel();

    try {
      const result = await vrmLoader.loadFromURL(url);

      if (result.success && result.data) {
        setModel(result.data);
        setMetadata({
          name: result.data.metadata.title,
          version: result.data.metadata.version,
          author: result.data.metadata.author,
        });
      } else {
        setError(result.error?.message || 'Failed to load VRM model');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  }, [setModel, setLoading, setError, clearError, clearStoreModel, setMetadata]);

  /**
   * Load VRM from File
   */
  const loadFromFile = useCallback(async (file: File) => {
    setLoading(true);
    clearError();
    clearStoreModel();

    try {
      const validation = validateModelFile(file);
      
      if (!validation.valid) {
        setError(validation.error || 'Invalid file');
        setLoading(false);
        return;
      }

      const result = await loaderManager.loadFromFile(file);

      if (result.success && result.data) {
        // For VRM files, use vrmLoader directly to get full VRM structure
        if (result.data.metadata?.format === 'vrm') {
          const vrmResult = await vrmLoader.loadFromFile(file);
          if (vrmResult.success && vrmResult.data) {
            setModel(vrmResult.data);
            setMetadata({
              name: vrmResult.data.metadata.title,
              version: vrmResult.data.metadata.version,
              author: vrmResult.data.metadata.author,
            });
          } else {
            setError(vrmResult.error?.message || 'Failed to load VRM model');
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
          
          setModel(vrmLikeModel);
          setMetadata({
            name: result.data.metadata?.name || file.name,
            version: '1.0',
            author: 'Unknown',
          });
        }
      } else {
        setError(result.error?.message || 'Failed to load model');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  }, [setModel, setLoading, setError, clearError, clearStoreModel, setMetadata]);

  /**
   * Load model from any supported file format
   */
  const loadModelFromFile = useCallback(async (file: File): Promise<VRMModel | null> => {
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

      const result = await loaderManager.loadFromFile(file);

      if (result.success && result.data) {
        // For VRM files, use vrmLoader directly to get full VRM structure
        if (result.data.metadata?.format === 'vrm') {
          const vrmResult = await vrmLoader.loadFromFile(file);
          if (vrmResult.success && vrmResult.data) {
            setModel(vrmResult.data);
            setMetadata({
              name: vrmResult.data.metadata.title,
              version: vrmResult.data.metadata.version,
              author: vrmResult.data.metadata.author,
            });
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
          
          setModel(vrmLikeModel);
          setMetadata({
            name: result.data.metadata?.name || file.name,
            version: '1.0',
            author: 'Unknown',
          });
          
          return vrmLikeModel;
        }
      } else {
        setError(result.error?.message || 'Failed to load model');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }

    return null;
  }, [setModel, setLoading, setError, clearError, clearStoreModel, setMetadata]);

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
    metadata,
    loadFromURL,
    loadFromFile,
    loadModelFromFile,
    clearCurrentModel,
  };
}
