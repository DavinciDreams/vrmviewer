/**
 * Camera Manager
 * Manages Three.js camera and camera controls with OrbitControls
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/**
 * Camera configuration options
 */
export interface CameraConfig {
  // Camera position
  position?: { x: number; y: number; z: number };
  // Camera target (look-at point)
  target?: { x: number; y: number; z: number };
  // Field of view
  fov?: number;
  // Near clipping plane
  near?: number;
  // Far clipping plane
  far?: number;
}

/**
 * OrbitControls configuration options
 */
export interface OrbitControlsConfig {
  // Enable/disable controls
  enabled?: boolean;
  // Enable damping for smooth movement
  enableDamping?: boolean;
  // Damping factor (0-1, lower = more damping)
  dampingFactor?: number;
  // Enable rotation
  enableRotate?: boolean;
  // Rotation speed
  rotateSpeed?: number;
  // Minimum polar angle (vertical rotation, in radians)
  minPolarAngle?: number;
  // Maximum polar angle (vertical rotation, in radians)
  maxPolarAngle?: number;
  // Minimum azimuth angle (horizontal rotation, in radians)
  minAzimuthAngle?: number;
  // Maximum azimuth angle (horizontal rotation, in radians)
  maxAzimuthAngle?: number;
  // Enable zoom
  enableZoom?: boolean;
  // Zoom speed
  zoomSpeed?: number;
  // Minimum distance to target
  minDistance?: number;
  // Maximum distance to target
  maxDistance?: number;
  // Enable pan
  enablePan?: boolean;
  // Pan speed
  panSpeed?: number;
  // Use screen space panning
  screenSpacePanning?: boolean;
}

/**
 * Default camera configuration for VRM viewing
 */
const DEFAULT_CAMERA_CONFIG: Required<CameraConfig> = {
  position: { x: 0, y: 1.5, z: 2 },
  target: { x: 0, y: 1, z: 0 },
  fov: 60,
  near: 0.1,
  far: 10000,
};

/**
 * Default OrbitControls configuration for VRM viewing
 */
const DEFAULT_CONTROLS_CONFIG: Required<OrbitControlsConfig> = {
  enabled: true,
  enableDamping: true,
  dampingFactor: 0.05,
  enableRotate: true,
  rotateSpeed: 1.0,
  minPolarAngle: 0,
  maxPolarAngle: Math.PI,
  minAzimuthAngle: -Infinity,
  maxAzimuthAngle: Infinity,
  enableZoom: true,
  zoomSpeed: 1.0,
  minDistance: 0.5,
  maxDistance: 10,
  enablePan: true,
  panSpeed: 1.0,
  screenSpacePanning: true,
};

/**
 * Camera Manager Class
 */
export class CameraManager {
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private renderer: THREE.WebGLRenderer;

  constructor(
    canvas: HTMLCanvasElement,
    renderer: THREE.WebGLRenderer,
    cameraConfig?: CameraConfig,
    controlsConfig?: OrbitControlsConfig
  ) {
    this.renderer = renderer;

    // Merge provided config with defaults
    const config = { ...DEFAULT_CAMERA_CONFIG, ...cameraConfig };
    const orbitConfig = { ...DEFAULT_CONTROLS_CONFIG, ...controlsConfig };

    // Initialize camera
    this.camera = new THREE.PerspectiveCamera(
      config.fov,
      canvas.clientWidth / canvas.clientHeight,
      config.near,
      config.far
    );

    // Initialize orbit controls
    this.controls = new OrbitControls(this.camera, renderer.domElement);

    // Set default camera position and target
    this.camera.position.set(config.position.x, config.position.y, config.position.z);
    this.controls.target.set(config.target.x, config.target.y, config.target.z);

    // Configure OrbitControls
    this.configureControls(orbitConfig);

    // Handle window resize
    window.addEventListener('resize', this.handleResize);
  }

  /**
   * Configure OrbitControls with the provided options
   */
  configureControls(config: Partial<OrbitControlsConfig>): void {
    const mergedConfig = { ...DEFAULT_CONTROLS_CONFIG, ...config };

    // Basic controls
    this.controls.enabled = mergedConfig.enabled;
    this.controls.enableDamping = mergedConfig.enableDamping;
    this.controls.dampingFactor = mergedConfig.dampingFactor;

    // Rotation controls
    this.controls.enableRotate = mergedConfig.enableRotate;
    this.controls.rotateSpeed = mergedConfig.rotateSpeed;
    this.controls.minPolarAngle = mergedConfig.minPolarAngle;
    this.controls.maxPolarAngle = mergedConfig.maxPolarAngle;
    this.controls.minAzimuthAngle = mergedConfig.minAzimuthAngle;
    this.controls.maxAzimuthAngle = mergedConfig.maxAzimuthAngle;

    // Zoom controls
    this.controls.enableZoom = mergedConfig.enableZoom;
    this.controls.zoomSpeed = mergedConfig.zoomSpeed;
    this.controls.minDistance = mergedConfig.minDistance;
    this.controls.maxDistance = mergedConfig.maxDistance;

    // Pan controls
    this.controls.enablePan = mergedConfig.enablePan;
    this.controls.panSpeed = mergedConfig.panSpeed;
    this.controls.screenSpacePanning = mergedConfig.screenSpacePanning;

    // Update controls to apply changes
    this.controls.update();
  }

  /**
   * Get current controls configuration
   */
  getControlsConfig(): OrbitControlsConfig {
    return {
      enabled: this.controls.enabled,
      enableDamping: this.controls.enableDamping,
      dampingFactor: this.controls.dampingFactor,
      enableRotate: this.controls.enableRotate,
      rotateSpeed: this.controls.rotateSpeed,
      minPolarAngle: this.controls.minPolarAngle,
      maxPolarAngle: this.controls.maxPolarAngle,
      minAzimuthAngle: this.controls.minAzimuthAngle,
      maxAzimuthAngle: this.controls.maxAzimuthAngle,
      enableZoom: this.controls.enableZoom,
      zoomSpeed: this.controls.zoomSpeed,
      minDistance: this.controls.minDistance,
      maxDistance: this.controls.maxDistance,
      enablePan: this.controls.enablePan,
      panSpeed: this.controls.panSpeed,
      screenSpacePanning: this.controls.screenSpacePanning,
    };
  }

  /**
   * Get camera
   */
  getCamera(): THREE.PerspectiveCamera {
    return this.camera;
  }

  /**
   * Get controls
   */
  getControls(): OrbitControls {
    return this.controls;
  }

  /**
   * Update controls (should be called in render loop)
   */
  updateControls(): void {
    this.controls.update();
  }

  /**
   * Get renderer
   */
  getRenderer(): THREE.WebGLRenderer {
    return this.renderer;
  }

  /**
   * True when this manager still owns the active canvas/renderer pair.
   */
  isAttachedTo(canvas: HTMLCanvasElement, renderer: THREE.WebGLRenderer): boolean {
    return this.controls.domElement === renderer.domElement && renderer.domElement === canvas;
  }

  /**
   * Focus camera on target
   */
  focusOn(target: THREE.Vector3): void {
    this.controls.target.copy(target);
    this.controls.update();
  }

  /**
   * Position the camera so the given object is visible in the current viewport.
   */
  frameObject(object: THREE.Object3D, padding = 1.35): void {
    const box = new THREE.Box3().setFromObject(object);
    if (box.isEmpty()) {
      this.resetCamera();
      return;
    }

    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const radius = Math.max(size.length() * 0.5, 0.01);
    const verticalFov = THREE.MathUtils.degToRad(this.camera.fov);
    const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * this.camera.aspect);
    const fitHeightDistance = size.y / (2 * Math.tan(verticalFov / 2));
    const fitWidthDistance = size.x / (2 * Math.tan(horizontalFov / 2));
    const fitDepthDistance = size.z * 0.5;
    const distance = Math.max(fitHeightDistance, fitWidthDistance, fitDepthDistance, radius) * padding;
    const direction = new THREE.Vector3(0.8, 0.45, 1).normalize();

    this.controls.target.copy(center);
    this.camera.position.copy(center).add(direction.multiplyScalar(distance));
    this.camera.near = Math.max(distance - radius * 8, 0.001);
    this.camera.far = Math.max(distance + radius * 8, 100);
    this.controls.minDistance = Math.max(radius * 0.05, 0.01);
    this.controls.maxDistance = Math.max(distance * 10, radius * 10, 10);
    this.camera.lookAt(center);
    this.camera.updateProjectionMatrix();
    this.controls.update();
  }

  /**
   * Reset camera position
   */
  resetCamera(): void {
    this.camera.position.set(0, 1.5, 2);
    this.camera.lookAt(0, 1, 0);
    this.controls.target.set(0, 1, 0);
    this.controls.update();
  }

  /**
   * Set camera position
   */
  setCameraPosition(position: THREE.Vector3): void {
    this.camera.position.copy(position);
    this.controls.update();
  }

  /**
   * Set camera target
   */
  setCameraTarget(target: THREE.Vector3): void {
    this.controls.target.copy(target);
    this.controls.update();
  }

  /**
   * Zoom camera
   */
  zoom(delta: number): void {
    const zoomFactor = delta > 0 ? 1.1 : 0.9;
    this.camera.position.multiplyScalar(zoomFactor);
    this.controls.update();
  }

  /**
   * Rotate camera
   */
  rotate(delta: THREE.Vector2): void {
    const spherical = new THREE.Spherical();
    spherical.setFromVector3(this.camera.position);
    spherical.theta -= delta.x;
    spherical.phi -= delta.y;
    spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi));
    this.camera.position.setFromSpherical(spherical);
    this.controls.update();
  }

  /**
   * Set OrbitControls pan speed (delegates to underlying controls).
   */
  setPanSpeed(speed: number): void {
    this.controls.panSpeed = speed;
    this.controls.update();
  }

  /**
   * Set OrbitControls rotation speed.
   */
  setRotateSpeed(speed: number): void {
    this.controls.rotateSpeed = speed;
    this.controls.update();
  }

  /**
   * Set OrbitControls zoom speed.
   */
  setZoomSpeed(speed: number): void {
    this.controls.zoomSpeed = speed;
    this.controls.update();
  }

  /**
   * Update aspect ratio
   */
  updateAspectRatio(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  /**
   * Handle window resize
   */
  private handleResize = (): void => {
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.renderer.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  /**
   * Dispose camera and controls
   */
  dispose(): void {
    this.controls.dispose();
    // Camera doesn't have a dispose method in Three.js
    window.removeEventListener('resize', this.handleResize);
  }
}

/**
 * Create singleton instance
 */
// Note: Singleton initialization requires canvas and renderer to be available at runtime
// This should be initialized when the application mounts
export let cameraManager: CameraManager | null;
export function initializeCameraManager(canvas: HTMLCanvasElement, renderer: THREE.WebGLRenderer): CameraManager {
  if (cameraManager && !cameraManager.isAttachedTo(canvas, renderer)) {
    cameraManager.dispose();
    cameraManager = null;
  }

  if (!cameraManager) {
    cameraManager = new CameraManager(canvas, renderer);
  }
  return cameraManager;
}

export function disposeCameraManager(): void {
  if (cameraManager) {
    cameraManager.dispose();
    cameraManager = null;
  }
}
