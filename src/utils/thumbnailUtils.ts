/**
 * Thumbnail Utilities
 * Utilities for capturing and processing thumbnails from Three.js scenes
 */

import * as THREE from 'three';

/**
 * Capture thumbnail options
 */
export interface CaptureThumbnailOptions {
  size?: number;
  format?: 'png' | 'jpeg' | 'webp';
  quality?: number;
  backgroundColor?: string;
}

/**
 * Capture thumbnail from Three.js scene
 * 
 * @param _renderer - The WebGLRenderer to use
 * @param scene - The scene to render
 * @param camera - The camera to use
 * @param options - Capture options
 * @returns Base64 data URL of the captured thumbnail
 */
export async function captureThumbnail(
  _renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  options: CaptureThumbnailOptions = {}
): Promise<string> {
  const {
    size = 256,
    format = 'png',
    quality = 0.9,
    backgroundColor = null,
  } = options;

  return new Promise((resolve, reject) => {
    try {
      // Create offscreen canvas for thumbnail
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;

      // Create temporary renderer for thumbnail
      const thumbnailRenderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: backgroundColor === null,
        preserveDrawingBuffer: true,
      });

      thumbnailRenderer.setSize(size, size);
      thumbnailRenderer.setPixelRatio(1);

      // Set background color if provided
      if (backgroundColor !== null) {
        thumbnailRenderer.setClearColor(new THREE.Color(backgroundColor));
      }

      const thumbnailCamera = cloneCameraForSquareCapture(camera);

      // Render the scene
      thumbnailRenderer.render(scene, thumbnailCamera);

      // Get data URL
      const mimeType = format === 'jpeg' ? 'image/jpeg' : format === 'webp' ? 'image/webp' : 'image/png';
      const dataUrl = canvas.toDataURL(mimeType, quality);

      // Clean up
      thumbnailRenderer.dispose();

      resolve(dataUrl);
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Clone the active viewer camera for a square thumbnail render.
 *
 * Manual capture should reflect the camera the user just positioned. The old
 * path re-framed the object, which made different camera/capture attempts look
 * almost identical.
 */
function cloneCameraForSquareCapture(camera: THREE.Camera): THREE.Camera {
  if (camera instanceof THREE.PerspectiveCamera) {
    const thumbnailCamera = camera.clone();
    thumbnailCamera.aspect = 1;
    thumbnailCamera.updateProjectionMatrix();
    return thumbnailCamera;
  } else if (camera instanceof THREE.OrthographicCamera) {
    const thumbnailCamera = camera.clone();
    thumbnailCamera.updateProjectionMatrix();
    return thumbnailCamera;
  }

  // Fallback: create a default perspective camera
  const defaultCamera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  return defaultCamera;
}

/**
 * Parse base64 data URL to extract image data
 * 
 * @param dataUrl - Base64 data URL
 * @returns Object with format and base64 data
 */
export function parseDataUrl(dataUrl: string): { format: 'png' | 'jpeg' | 'webp'; data: string } {
  const match = dataUrl.match(/^data:image\/(png|jpeg|webp);base64,(.+)$/);
  
  if (!match) {
    throw new Error('Invalid data URL format');
  }

  const format = match[1] as 'png' | 'jpeg' | 'webp';
  const data = match[2];

  return { format, data };
}

/**
 * Get image dimensions from data URL
 * 
 * @param dataUrl - Base64 data URL
 * @returns Promise resolving to image dimensions
 */
export async function getImageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    
    img.onload = () => {
      resolve({ width: img.width, height: img.height });
    };
    
    img.onerror = () => {
      reject(new Error('Failed to load image from data URL'));
    };
    
    img.src = dataUrl;
  });
}
