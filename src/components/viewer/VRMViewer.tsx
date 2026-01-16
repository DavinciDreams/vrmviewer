/**
 * VRMViewer Component
 * Main 3D viewer component with animation support
 */

import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { VRM } from '@pixiv/three-vrm';
import { useVRMStore } from '../../store/vrmStore';
import { usePlaybackStore } from '../../store/playbackStore';

/**
 * VRMViewer props
 */
export interface VRMViewerProps {
  onCanvasRef?: (canvas: HTMLCanvasElement) => void;
  onVRMLoaded?: (vrm: VRM) => void;
  onAnimationFrame?: () => void;
}

/**
 * VRMViewer component
 */
export const VRMViewer: React.FC<VRMViewerProps> = ({
  onCanvasRef,
  onVRMLoaded,
  onAnimationFrame,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Store state
  const { currentModel, isLoading: vrmLoading } = useVRMStore();
  const {
    isPlaying,
    loop,
  } = usePlaybackStore();

  // Local state
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const [error] = useState<string | null>(null);

  /**
   * Initialize Three.js scene
   */
  useEffect(() => {
    if (!canvasRef.current) return;

    // Create scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);
    sceneRef.current = scene;

    // Create camera
    const camera = new THREE.PerspectiveCamera(
      45,
      canvasRef.current.clientWidth / canvasRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 1.5, 3);
    camera.lookAt(0, 1, 0);
    cameraRef.current = camera;

    // Create renderer
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
      alpha: true,
    });
    renderer.setSize(canvasRef.current.clientWidth, canvasRef.current.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    // Add lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 7);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);

    // Handle resize
    const handleResize = () => {
      if (!canvasRef.current || !camera || !renderer) return;
      
      camera.aspect = canvasRef.current.clientWidth / canvasRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(canvasRef.current.clientWidth, canvasRef.current.clientHeight);
    };

    window.addEventListener('resize', handleResize);

    // Notify parent of canvas ref
    if (onCanvasRef) {
      onCanvasRef(canvasRef.current);
    }

    setIsInitialized(true);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      renderer.dispose();
    };
  }, [onCanvasRef]);

  /**
   * Add VRM to scene when loaded
   */
  useEffect(() => {
    if (currentModel && isInitialized && sceneRef.current) {
      // Clear previous models
      while (sceneRef.current!.children.length > 0) {
        const child = sceneRef.current!.children[0];
        if (child instanceof THREE.Light) {
          // Keep lights
          break;
        }
        sceneRef.current!.remove(child);
      }

      // Add VRM to scene
      sceneRef.current!.add(currentModel.scene);
      
      // Center and scale VRM
      const box = new THREE.Box3().setFromObject(currentModel.scene);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      
      // Center VRM
      currentModel.scene.position.sub(center);
      currentModel.scene.position.y = -box.min.y;
      
      // Scale to reasonable height
      const targetHeight = 1.6; // meters
      const scale = targetHeight / size.y;
      currentModel.scene.scale.setScalar(scale);

      // Notify parent
      if (onVRMLoaded) {
        onVRMLoaded(currentModel);
      }
    }
  }, [currentModel, isInitialized, onVRMLoaded]);

  /**
   * Animation loop
   */
  useEffect(() => {
    if (!isInitialized || !rendererRef.current) return;

    const animate = () => {
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
  }, [isInitialized, onAnimationFrame]);

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
      {!currentModel && !vrmLoading && !error && (
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
      {currentModel && !vrmLoading && !error && (
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
};
