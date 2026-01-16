/**
 * Camera Manager
 * Manages Three.js camera and camera controls
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/**
 * Camera Manager Class
 */
export class CameraManager {
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private renderer: THREE.WebGLRenderer;
  private canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement, renderer: THREE.WebGLRenderer) {
    this.canvas = canvas;
    this.renderer = renderer;

    // Initialize camera
    this.camera = new THREE.PerspectiveCamera(
      60,
      canvas.clientWidth / canvas.clientHeight,
      0.1,
      10000
    );

    // Initialize orbit controls
    this.controls = new OrbitControls(this.camera, renderer.domElement);

    // Set default camera position
    this.camera.position.set(0, 1.5, 2);
    this.controls.target.set(0, 1, 0);

    // Update controls
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.screenSpacePanning = false;
    this.controls.minDistance = 0.5;
    this.controls.maxDistance = 10;

    // Handle window resize
    window.addEventListener('resize', this.handleResize);
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
   * Get renderer
   */
  getRenderer(): THREE.WebGLRenderer {
    return this.renderer;
  }

  /**
   * Focus camera on target
   */
  focusOn(target: THREE.Vector3): void {
    this.controls.target.copy(target);
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
  zoom(_delta: number): void {
    const zoomFactor = 1.1;
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
    this.camera.dispose();
    window.removeEventListener('resize', this.handleResize);
  }
}

/**
 * Create singleton instance
 */
export const cameraManager = new CameraManager(document.querySelector('canvas') as HTMLCanvasElement, null);
