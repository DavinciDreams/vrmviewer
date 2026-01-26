/**
 * useThumbnailCapture Hook
 * Custom hook for automatic thumbnail capture on model load
 */

import { useCallback, useRef } from 'react';
import * as THREE from 'three';
import { captureThumbnail, CaptureThumbnailOptions } from '../utils/thumbnailUtils';
import { getThumbnailService } from '../core/database/services/ThumbnailService';
import { v4 as uuidv4 } from 'uuid';

/**
 * Thumbnail capture configuration
 */
export interface ThumbnailCaptureConfig {
  enabled?: boolean;
  size?: number;
  format?: 'png' | 'jpeg' | 'webp';
  quality?: number;
  backgroundColor?: string;
  delay?: number; // Delay in milliseconds before capturing (default: 100ms)
  useFixedAngle?: boolean; // Use fixed camera angle for consistent thumbnails
}

/**
 * Thumbnail capture result
 */
export interface ThumbnailCaptureResult {
  success: boolean;
  thumbnail?: string;
  error?: string;
}

/**
 * useThumbnailCapture Hook
 * 
 * @param config - Thumbnail capture configuration
 * @returns Object with capture methods and state
 */
export function useThumbnailCapture(config: ThumbnailCaptureConfig = {}) {
  const {
    enabled = true,
    size = 256,
    format = 'webp',
    quality = 0.85,
    backgroundColor = '#1a1a2e',
    delay = 100,
    useFixedAngle = false,
  } = config;

  const thumbnailService = getThumbnailService();
  const isCapturingRef = useRef(false);

  /**
   * Capture thumbnail from Three.js renderer
   * 
   * @param renderer - The WebGLRenderer
   * @param scene - The scene to render
   * @param camera - The camera to use
   * @param options - Override capture options
   * @returns Promise resolving to base64 data URL
   */
  const capture = useCallback(async (
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    options?: Partial<CaptureThumbnailOptions>
  ): Promise<string> => {
    if (!enabled) {
      throw new Error('Thumbnail capture is disabled');
    }

    if (isCapturingRef.current) {
      throw new Error('Thumbnail capture already in progress');
    }

    isCapturingRef.current = true;

    try {
      // Wait for the scene to be fully rendered
      await new Promise(resolve => setTimeout(resolve, delay));

      // Capture thumbnail
      const thumbnail = await captureThumbnail(
        renderer,
        scene,
        camera,
        {
          size: options?.size || size,
          format: options?.format || format,
          quality: options?.quality || quality,
          backgroundColor: options?.backgroundColor || backgroundColor,
        }
      );

      return thumbnail;
    } finally {
      isCapturingRef.current = false;
    }
  }, [enabled, size, format, quality, backgroundColor, delay]);

  /**
   * Capture and save thumbnail for a model
   * 
   * @param renderer - The WebGLRenderer
   * @param scene - The scene to render
   * @param camera - The camera to use
   * @param modelUuid - UUID of the model
   * @param modelName - Name of the model
   * @param options - Override capture options
   * @returns Promise resolving to capture result
   */
  const captureAndSave = useCallback(async (
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    modelUuid: string,
    modelName: string,
    options?: Partial<CaptureThumbnailOptions>
  ): Promise<ThumbnailCaptureResult> => {
    if (!enabled) {
      return {
        success: false,
        error: 'Thumbnail capture is disabled',
      };
    }

    try {
      // Capture thumbnail
      const thumbnail = await capture(renderer, scene, camera, options);

      // Parse data URL to get format and base64 data
      const dataUrlMatch = thumbnail.match(/^data:image\/(png|jpeg|webp);base64,(.+)$/);
      if (!dataUrlMatch) {
        throw new Error('Invalid thumbnail data URL format');
      }

      const thumbnailFormat = dataUrlMatch[1] as 'png' | 'jpeg' | 'webp';
      const base64Data = dataUrlMatch[2];

      // Save thumbnail to database
      const result = await thumbnailService.saveThumbnail({
        uuid: uuidv4(),
        name: `${modelName}_thumbnail`,
        type: 'model',
        targetUuid: modelUuid,
        data: base64Data,
        format: thumbnailFormat,
        width: options?.size || size,
        height: options?.size || size,
        size: base64Data.length,
        createdAt: new Date(),
      });

      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to save thumbnail');
      }

      return {
        success: true,
        thumbnail: thumbnail,
      };
    } catch (error) {
      console.error('Failed to capture and save thumbnail:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }, [enabled, capture, size, thumbnailService]);

  /**
   * Capture thumbnail from viewer ref
   * 
   * @param viewerRef - Ref to VRMViewer component
   * @param modelUuid - UUID of the model
   * @param modelName - Name of the model
   * @param options - Override capture options
   * @returns Promise resolving to capture result
   */
  const captureFromViewer = useCallback(async (
    viewerRef: React.RefObject<{ captureThumbnail: (options?: { size?: number; format?: 'png' | 'jpeg' | 'webp' }) => Promise<string> }>,
    modelUuid: string,
    modelName: string,
    options?: Partial<CaptureThumbnailOptions>
  ): Promise<ThumbnailCaptureResult> => {
    if (!enabled) {
      return {
        success: false,
        error: 'Thumbnail capture is disabled',
      };
    }

    if (!viewerRef.current) {
      return {
        success: false,
        error: 'Viewer reference is not available',
      };
    }

    try {
      // Capture thumbnail from viewer
      const thumbnail = await viewerRef.current.captureThumbnail({
        size: options?.size || size,
        format: options?.format || format,
      });

      // Parse data URL to get format and base64 data
      const dataUrlMatch = thumbnail.match(/^data:image\/(png|jpeg|webp);base64,(.+)$/);
      if (!dataUrlMatch) {
        throw new Error('Invalid thumbnail data URL format');
      }

      const thumbnailFormat = dataUrlMatch[1] as 'png' | 'jpeg' | 'webp';
      const base64Data = dataUrlMatch[2];

      // Save thumbnail to database
      const result = await thumbnailService.saveThumbnail({
        uuid: uuidv4(),
        name: `${modelName}_thumbnail`,
        type: 'model',
        targetUuid: modelUuid,
        data: base64Data,
        format: thumbnailFormat,
        width: options?.size || size,
        height: options?.size || size,
        size: base64Data.length,
        createdAt: new Date(),
      });

      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to save thumbnail');
      }

      return {
        success: true,
        thumbnail: thumbnail,
      };
    } catch (error) {
      console.error('Failed to capture thumbnail from viewer:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }, [enabled, size, format, thumbnailService]);

  /**
   * Delete thumbnail for a model
   * 
   * @param modelUuid - UUID of the model
   * @returns Promise resolving to success status
   */
  const deleteThumbnail = useCallback(async (modelUuid: string): Promise<boolean> => {
    try {
      const result = await thumbnailService.deleteThumbnailByTarget(modelUuid);
      return result.success;
    } catch (error) {
      console.error('Failed to delete thumbnail:', error);
      return false;
    }
  }, [thumbnailService]);

  /**
   * Get thumbnail for a model
   * 
   * @param modelUuid - UUID of the model
   * @returns Promise resolving to data URL or null
   */
  const getThumbnail = useCallback(async (modelUuid: string): Promise<string | null> => {
    try {
      const result = await thumbnailService.getThumbnailByTarget(modelUuid);
      if (result.success && result.data) {
        return `data:image/${result.data.format};base64,${result.data.data}`;
      }
      return null;
    } catch (error) {
      console.error('Failed to get thumbnail:', error);
      return null;
    }
  }, [thumbnailService]);

  return {
    capture,
    captureAndSave,
    captureFromViewer,
    deleteThumbnail,
    getThumbnail,
    isCapturing: () => isCapturingRef.current,
  };
}
