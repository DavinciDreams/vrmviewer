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
import { extractAllMetadata, type PipelineResult } from '../core/metadata/MetadataPipeline';
import type { ExtractedBundle } from '../core/database/services/ModelService';

/** Timeout (ms) after which extraction is abandoned so the user isn't blocked. */
const EXTRACTION_TIMEOUT_MS = 5_000;

/**
 * Build PipelineArgs from a raw loader result and run extractAllMetadata with a
 * hard timeout. Returns an ExtractedBundle or null if extraction fails/times out.
 */
async function safeExtract(
  parsed: unknown,
  arrayBuffer: ArrayBuffer | undefined,
  format = 'vrm'
): Promise<ExtractedBundle | null> {
  if (!arrayBuffer) return null;

  const timeoutPromise = new Promise<null>((resolve) =>
    setTimeout(() => resolve(null), EXTRACTION_TIMEOUT_MS)
  );

  try {
    // Derive scene from parsed result — best-effort across formats.
    const parsedAsRecord = parsed as Record<string, unknown> | null | undefined;
    const scene: THREE.Object3D =
      (parsedAsRecord?.scene as THREE.Object3D | undefined) ??
      (parsedAsRecord?.['userData'] !== undefined ? parsed as unknown as THREE.Object3D : new THREE.Object3D());

    const vrm = parsedAsRecord?.vrm as import('@pixiv/three-vrm').VRM | undefined;
    const animations = (parsedAsRecord?.animations as THREE.AnimationClip[] | undefined) ?? [];

    const result = await Promise.race<PipelineResult | null>([
      extractAllMetadata({ scene, vrm, buffer: arrayBuffer, format, animations }),
      timeoutPromise,
    ]);

    if (!result) return null;
    return result as ExtractedBundle;
  } catch (err) {
    console.warn('[useVRM] Metadata extraction failed — proceeding without bundle:', err);
    return null;
  }
}

/**
 * Build a non-VRM `VRMModel`-shaped wrapper around a generic loader result so
 * the rest of the app can treat all formats uniformly.
 */
function buildNonVRMModelShim(
  loadData: { model?: unknown; metadata?: { name?: string } },
  filename: string
): VRMModel {
  return {
    vrm: undefined as never,
    metadata: {
      title: loadData.metadata?.name || filename,
      version: '1.0',
      author: 'Unknown',
    },
    expressions: new Map(),
    humanoid: { humanBones: [] },
    firstPerson: undefined,
    scene: loadData.model as THREE.Group,
    skeleton: undefined as never,
  };
}

/**
 * Run the metadata pipeline against a VRM file (which is loaded by `vrmLoader`
 * directly, bypassing the LoaderManager that surfaces the ArrayBuffer). We
 * re-read the File here — `File.arrayBuffer()` is idempotent in browsers.
 */
async function extractFromVRMFile(file: File, vrmModel: VRMModel): Promise<ExtractedBundle | null> {
  const ab = await file.arrayBuffer();
  return safeExtract(vrmModel, ab, 'vrm');
}

/**
 * useVRM Hook
 */
export function useVRM() {
  const {
    currentModel,
    isLoading,
    error,
    metadata,
    extractedBundle,
    setModel,
    setLoading,
    setError,
    clearError,
    setMetadata,
    setExtractedBundle,
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
        // Extraction from URL — no ArrayBuffer surfaced; skip silently.
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

      // Check if this is a VRM file
      const extension = file.name.split('.').pop()?.toLowerCase();
      const isVRM = extension === 'vrm';

      if (isVRM) {
        const vrmResult = await vrmLoader.loadFromFile(file);
        if (vrmResult.success && vrmResult.data) {
          setModel(vrmResult.data);
          setMetadata({
            name: vrmResult.data.metadata.title,
            version: vrmResult.data.metadata.version,
            author: vrmResult.data.metadata.author,
          });
          setExtractedBundle(await extractFromVRMFile(file, vrmResult.data));
        } else {
          setError(vrmResult.error?.message || 'Failed to load VRM model');
        }
      } else {
        const result = await loaderManager.loadFromFile(file);
        if (result.success && result.data) {
          const vrmLikeModel = buildNonVRMModelShim(result.data, file.name);
          setModel(vrmLikeModel);
          setMetadata({
            name: vrmLikeModel.metadata.title,
            version: vrmLikeModel.metadata.version,
            author: vrmLikeModel.metadata.author,
          });
          const fmt = extension ?? 'glb';
          setExtractedBundle(
            await safeExtract(result.data.parsed, result.data.arrayBuffer, fmt)
          );
        } else {
          setError(result.error?.message || 'Failed to load model');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  }, [setModel, setLoading, setError, clearError, clearStoreModel, setMetadata, setExtractedBundle]);

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

      // Check if this is a VRM file
      const extension = file.name.split('.').pop()?.toLowerCase();
      const isVRM = extension === 'vrm';

      let vrmModel: VRMModel | null = null;

      if (isVRM) {
        const vrmResult = await vrmLoader.loadFromFile(file);
        if (vrmResult.success && vrmResult.data) {
          vrmModel = vrmResult.data;
          setModel(vrmModel);
          setMetadata({
            name: vrmModel.metadata.title,
            version: vrmModel.metadata.version,
            author: vrmModel.metadata.author,
          });
          setExtractedBundle(await extractFromVRMFile(file, vrmResult.data));
          return vrmModel;
        } else {
          setError(vrmResult.error?.message || 'Failed to load VRM model');
          return null;
        }
      } else {
        const result = await loaderManager.loadFromFile(file);
        if (result.success && result.data) {
          const vrmLikeModel = buildNonVRMModelShim(result.data, file.name);
          setModel(vrmLikeModel);
          setMetadata({
            name: vrmLikeModel.metadata.title,
            version: vrmLikeModel.metadata.version,
            author: vrmLikeModel.metadata.author,
          });
          const fmt2 = extension ?? 'glb';
          setExtractedBundle(
            await safeExtract(result.data.parsed, result.data.arrayBuffer, fmt2)
          );
          return vrmLikeModel;
        } else {
          setError(result.error?.message || 'Failed to load model');
          return null;
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      return null;
    } finally {
      setLoading(false);
    }
  }, [setModel, setLoading, setError, clearError, clearStoreModel, setMetadata, setExtractedBundle]);

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
    extractedBundle,
    loadFromURL,
    loadFromFile,
    loadModelFromFile,
    clearCurrentModel,
  };
}
