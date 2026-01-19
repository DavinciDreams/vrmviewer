/**
 * VRMViewer Component
 * Main 3D viewer component with animation support
 * Simplified for single model display
 */

import { useRef, useEffect, useState, useImperativeHandle, forwardRef } from 'react';
import * as THREE from 'three';
import { VRM } from '@pixiv/three-vrm';
import { useVRMStore, VRMModelEntry } from '../../store/vrmStore';
import { usePlaybackStore } from '../../store/playbackStore';
import { useAnimationStore } from '../../store/animationStore';
import { initializeCameraManager, cameraManager } from '../../core/three/scene/CameraManager';
import { captureThumbnail } from '../../utils/thumbnailUtils';

/**
 * VRMViewer imperative handle
 */
export interface VRMViewerHandle {
  toggleVisibility: () => void;
  toggleWireframe: () => void;
  isVisible: () => boolean;
  isWireframe: () => boolean;
  captureThumbnail: (options?: { size?: number; format?: 'png' | 'jpeg' | 'webp' }) => Promise<string>;
}

/**
 * VRMViewer props
 */
export interface VRMViewerProps {
  onCanvasRef?: (canvas: HTMLCanvasElement) => void;
  onVRMLoaded?: (vrm: VRM) => void;
  onAnimationFrame?: () => void;
}

/**
 * Calculate camera position to frame single model
 */
function calculateCameraFraming(
  model: VRMModelEntry,
  camera: THREE.PerspectiveCamera
): { position: THREE.Vector3; target: THREE.Vector3 } {
  // Calculate bounding box
  const box = new THREE.Box3().setFromObject(model.model.scene);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  
  // Calculate camera distance based on field of view
  const fov = camera.fov * (Math.PI / 180);
  const maxDimension = Math.max(size.x, size.y);
  const distance = maxDimension / (2 * Math.tan(fov / 2)) * 1.5;
  
  // Position camera
  const position = new THREE.Vector3(
    center.x,
    center.y + size.y * 0.5,
    center.z + distance
  );
  
  return { position, target: center };
}

/**
 * VRMViewer component
 */
export const VRMViewer = forwardRef<VRMViewerHandle, VRMViewerProps>(({
  onCanvasRef,
  onVRMLoaded,
  onAnimationFrame,
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const modelSceneRef = useRef<THREE.Group | null>(null);

  // Store state
  const { model, isLoading: vrmLoading } = useVRMStore();
  const {
    isPlaying,
    loop,
  } = usePlaybackStore();

  // Local state
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const [error] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState<boolean>(true);
  const [isWireframe, setIsWireframe] = useState<boolean>(false);

  /**
   * Apply visibility state to model
   */
  useEffect(() => {
    if (!isInitialized || !model) return;
    
    model.model.scene.visible = model.isVisible && isVisible;
  }, [isVisible, model, isInitialized]);

  /**
   * Apply wireframe state to model materials
   */
  useEffect(() => {
    if (!isInitialized || !model) return;
    
    const wireframe = model.isWireframe || isWireframe;
    
    const setWireframeRecursive = (object: THREE.Object3D) => {
      if (object instanceof THREE.Mesh && object.material) {
        const material = object.material;
        if (Array.isArray(material)) {
          material.forEach(mat => {
            mat.wireframe = wireframe;
            mat.needsUpdate = true;
          });
        } else {
          material.wireframe = wireframe;
          material.needsUpdate = true;
        }
      }
      object.children.forEach(child => setWireframeRecursive(child));
    };
    
    setWireframeRecursive(model.model.scene);
  }, [isWireframe, model, isInitialized]);

  /**
   * Position model in scene
   */
  useEffect(() => {
    if (!isInitialized || !sceneRef.current) return;
    
    const scene = sceneRef.current;
    
    // Remove previous model if exists
    if (modelSceneRef.current) {
      scene.remove(modelSceneRef.current);
      modelSceneRef.current = null;
    }
    
    // Add new model if available
    if (model) {
      const modelScene = model.model.scene;
      
      // Calculate bounding box for normalization
      const box = new THREE.Box3().setFromObject(modelScene);
      const size = box.getSize(new THREE.Vector3());
      
      // Calculate scale to normalize height to 1.5 units
      const targetHeight = 1.5;
      const scale = targetHeight / size.y;
      
      // Calculate Y offset to place model on ground
      const yOffset = -box.min.y * scale;
      
      // Apply position, scale, and add to scene
      modelScene.position.set(0, yOffset, 0);
      modelScene.scale.setScalar(scale);
      scene.add(modelScene);
      modelSceneRef.current = modelScene;
      
      // Notify parent (only if VRM object is available)
      if (onVRMLoaded && model.model.vrm) {
        onVRMLoaded(model.model.vrm);
      }
      
      // Update camera to frame the model
      if (cameraManager) {
        const framing = calculateCameraFraming(model, cameraManager.getCamera());
        cameraManager.getCamera().position.copy(framing.position);
        cameraManager.getControls().target.copy(framing.target);
        cameraManager.getControls().update();
      }
    }
  }, [model, isInitialized, onVRMLoaded]);

  /**
   * Toggle visibility
   */
  const toggleVisibility = () => {
    setIsVisible(prev => !prev);
  };

  /**
   * Toggle wireframe
   */
  const toggleWireframe = () => {
    setIsWireframe(prev => !prev);
  };

  /**
   * Capture thumbnail
   */
  const captureThumbnailMethod = async (options?: { size?: number; format?: 'png' | 'jpeg' | 'webp' }) => {
    if (!rendererRef.current || !sceneRef.current || !cameraRef.current) {
      throw new Error('Viewer not initialized');
    }

    return await captureThumbnail(
      rendererRef.current,
      sceneRef.current,
      cameraRef.current,
      {
        size: options?.size || 256,
        format: options?.format || 'png',
        quality: 0.9,
        backgroundColor: '#1a1a2e', // Match scene background
      }
    );
  };

  /**
   * Expose methods via ref
   */
  useImperativeHandle(ref, () => ({
    toggleVisibility,
    toggleWireframe,
    isVisible: () => isVisible,
    isWireframe: () => isWireframe,
    captureThumbnail: captureThumbnailMethod,
  }), [isVisible, isWireframe]);

  /**
   * Initialize Three.js scene
   */
  useEffect(() => {
    if (!canvasRef.current) return;

    // Create scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);
    sceneRef.current = scene;

    // Cache canvas dimensions
    const width = canvasRef.current.clientWidth;
    const height = canvasRef.current.clientHeight;

    // Create renderer
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: false,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    rendererRef.current = renderer;

    // Initialize CameraManager with canvas and renderer
    initializeCameraManager(canvasRef.current, renderer);
    const camManager = cameraManager;
    if (camManager) {
      cameraRef.current = camManager.getCamera();
    }

    // Add lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 7);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 1024;
    directionalLight.shadow.mapSize.height = 1024;
    scene.add(directionalLight);

    // Notify parent of canvas ref
    if (onCanvasRef) {
      onCanvasRef(canvasRef.current);
    }

    setIsInitialized(true);

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      renderer.dispose();
      if (camManager) {
        camManager.dispose();
      }
    };
  }, [onCanvasRef]);

  /**
   * Animation loop
   */
  useEffect(() => {
    if (!isInitialized || !rendererRef.current) return;

    const animate = () => {
      // Update orbit controls
      if (cameraManager) {
        cameraManager.updateControls();
      }

      // Update animation managers
      const { animationManager, blendShapeManager, idleAnimationController } = useAnimationStore.getState();
      animationManager?.update();
      blendShapeManager?.update();
      idleAnimationController?.update();

      // Render
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }

      // Notify parent
      if (onAnimationFrame) {
        onAnimationFrame();
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isInitialized]);

  const hasModel = model !== null;

  return (
    <div className="relative w-full h-full bg-gray-900">
      <canvas
        ref={canvasRef}
        className="w-full h-full block"
      />

      {/* Loading indicator */}
      {vrmLoading && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-gray-900/80">
          <div className="text-center">
            <svg className="w-16 h-16 text-blue-500 mx-auto mb-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <p className="text-gray-300 text-sm">Loading VRM model...</p>
          </div>
        </div>
      )}

      {/* Error indicator */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-gray-900/80">
          <div className="text-center">
            <svg className="w-16 h-16 text-red-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-red-400 text-sm mb-2">Error loading model</p>
            <p className="text-gray-400 text-xs">{error}</p>
          </div>
        </div>
      )}

      {/* Drop zone indicator */}
      {!hasModel && !vrmLoading && !error && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <svg className="w-16 h-16 text-gray-600 mx-auto mb-4 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-gray-500 text-sm">Drop a VRM file to begin</p>
          </div>
        </div>
      )}

      {/* Playback info overlay */}
      {hasModel && !vrmLoading && !error && (
        <div className="absolute bottom-4 left-4 bg-black/60 text-white px-3 py-2 rounded text-xs">
          <div className="flex items-center gap-2">
            {isPlaying && (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                Playing
              </span>
            )}
            {!isPlaying && (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 bg-yellow-500 rounded-full" />
                Paused
              </span>
            )}
            {loop && (
              <span className="text-blue-400">
                Loop
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

VRMViewer.displayName = 'VRMViewer';
