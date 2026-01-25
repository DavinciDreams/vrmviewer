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
  useFixedAngle?: boolean;
  fixedCameraPosition?: { x: number; y: number; z: number };
  fixedCameraTarget?: { x: number; y: number; z: number };
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
    format = 'webp',
    quality = 0.85,
    backgroundColor = null,
    useFixedAngle = false,
    fixedCameraPosition = { x: 0, y: 1.4, z: 2.5 },
    fixedCameraTarget = { x: 0, y: 1, z: 0 },
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

      // Clone the scene to avoid modifying the original
      const clonedScene = cloneScene(scene);

      // Set up camera for thumbnail
      const thumbnailCamera = setupCameraForThumbnail(camera, useFixedAngle, fixedCameraPosition, fixedCameraTarget);

      // Render the scene
      thumbnailRenderer.render(clonedScene, thumbnailCamera);

      // Get data URL
      const mimeType = format === 'jpeg' ? 'image/jpeg' : format === 'webp' ? 'image/webp' : 'image/png';
      const dataUrl = canvas.toDataURL(mimeType, quality);

      // Clean up
      thumbnailRenderer.dispose();
      clonedScene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          if (object.geometry) object.geometry.dispose();
          if (Array.isArray(object.material)) {
            object.material.forEach(mat => mat.dispose());
          } else if (object.material) {
            object.material.dispose();
          }
        }
      });

      resolve(dataUrl);
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Clone scene for thumbnail rendering
 */
function cloneScene(scene: THREE.Scene): THREE.Scene {
  const clonedScene = new THREE.Scene();
  
  scene.traverse((object) => {
    if (object instanceof THREE.Light) {
      // Clone lights
      const clonedLight = object.clone();
      clonedScene.add(clonedLight);
    } else if (object instanceof THREE.Group || object instanceof THREE.Mesh) {
      // Clone groups and meshes
      const cloned = object.clone();
      clonedScene.add(cloned);
    }
  });

  // Copy background if it's a color
  if (scene.background instanceof THREE.Color) {
    clonedScene.background = scene.background.clone();
  }

  return clonedScene;
}

/**
 * Set up camera for thumbnail rendering
 */
function setupCameraForThumbnail(
  camera: THREE.Camera,
  useFixedAngle: boolean = false,
  fixedPosition: { x: number; y: number; z: number } = { x: 0, y: 1.4, z: 2.5 },
  fixedTarget: { x: number; y: number; z: number } = { x: 0, y: 1, z: 0 }
): THREE.Camera {
  if (useFixedAngle) {
    // Use fixed camera position for consistent thumbnails
    const thumbnailCamera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    thumbnailCamera.position.set(fixedPosition.x, fixedPosition.y, fixedPosition.z);
    thumbnailCamera.lookAt(fixedTarget.x, fixedTarget.y, fixedTarget.z);
    return thumbnailCamera;
  }

  if (camera instanceof THREE.PerspectiveCamera) {
    const thumbnailCamera = camera.clone();
    thumbnailCamera.aspect = 1; // Square aspect ratio for thumbnail
    thumbnailCamera.updateProjectionMatrix();
    return thumbnailCamera;
  } else if (camera instanceof THREE.OrthographicCamera) {
    const thumbnailCamera = camera.clone();
    // Adjust frustum for square aspect ratio
    const frustumSize = thumbnailCamera.right - thumbnailCamera.left;
    const newSize = frustumSize;
    thumbnailCamera.left = -newSize / 2;
    thumbnailCamera.right = newSize / 2;
    thumbnailCamera.top = newSize / 2;
    thumbnailCamera.bottom = -newSize / 2;
    thumbnailCamera.updateProjectionMatrix();
    return thumbnailCamera;
  }

  // Fallback: create a default perspective camera
  const defaultCamera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  defaultCamera.position.set(0, 1.6, 3);
  defaultCamera.lookAt(0, 1, 0);
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
