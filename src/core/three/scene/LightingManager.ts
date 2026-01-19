/**
 * Lighting Manager
 * Manages Three.js lighting setup for the 3D scene
 */

import * as THREE from 'three';

/**
 * Lighting Manager Class
 */
export class LightingManager {
  private scene: THREE.Scene;
  private ambientLight: THREE.AmbientLight;
  private directionalLight: THREE.DirectionalLight;
  private rimLight?: THREE.DirectionalLight;
  private renderer: THREE.WebGLRenderer;

  constructor(scene: THREE.Scene, renderer: THREE.WebGLRenderer) {
    this.scene = scene;
    this.renderer = renderer;

    // Initialize ambient light
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(this.ambientLight);

    // Initialize directional light
    this.directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    this.directionalLight.position.set(5, 10, 7.5);
    this.directionalLight.castShadow = true;
    this.directionalLight.shadow.mapSize.width = 2048;
    this.directionalLight.shadow.mapSize.height = 2048;
    this.directionalLight.shadow.camera.near = 0.1;
    this.directionalLight.shadow.camera.far = 50;
    this.directionalLight.shadow.bias = -0.0001;
    this.scene.add(this.directionalLight);

    // Enable shadows in renderer
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  }

  /**
   * Get ambient light
   */
  getAmbientLight(): THREE.AmbientLight {
    return this.ambientLight;
  }

  /**
   * Get directional light
   */
  getDirectionalLight(): THREE.DirectionalLight {
    return this.directionalLight;
  }

  /**
   * Get rim light
   */
  getRimLight(): THREE.DirectionalLight | undefined {
    return this.rimLight;
  }

  /**
   * Set ambient light intensity
   */
  setAmbientIntensity(intensity: number): void {
    this.ambientLight.intensity = intensity;
  }

  /**
   * Set directional light intensity
   */
  setDirectionalIntensity(intensity: number): void {
    this.directionalLight.intensity = intensity;
  }

  /**
   * Add rim light (optional)
   */
  addRimLight(color: number = 0xff0000, intensity: number = 0.5): void {
    if (this.rimLight) {
      this.scene.remove(this.rimLight);
    }

    this.rimLight = new THREE.DirectionalLight(color, intensity);
    this.rimLight.position.set(-5, 0, 5);
    this.scene.add(this.rimLight);
  }

  /**
   * Remove rim light
   */
  removeRimLight(): void {
    if (this.rimLight) {
      this.scene.remove(this.rimLight);
      this.rimLight = undefined;
    }
  }

  /**
   * Set directional light position
   */
  setLightPosition(x: number, y: number, z: number): void {
    this.directionalLight.position.set(x, y, z);
  }

  /**
   * Update lighting
   */
  update(): void {
    this.renderer.shadowMap.needsUpdate = true;
  }

  /**
   * Dispose lights
   */
  dispose(): void {
    this.scene.remove(this.ambientLight);
    this.scene.remove(this.directionalLight);
    
    if (this.rimLight) {
      this.scene.remove(this.rimLight);
      this.rimLight.dispose();
      this.rimLight = undefined;
    }

    this.ambientLight.dispose();
    this.directionalLight.dispose();
  }
}

/**
 * Create singleton instance
 * Note: This requires a scene and renderer to be provided
 */
let lightingManagerInstance: LightingManager | null = null;

export function getLightingManager(scene?: THREE.Scene, renderer?: THREE.WebGLRenderer): LightingManager {
  if (!lightingManagerInstance) {
    if (!scene || !renderer) {
      throw new Error('LightingManager requires scene and renderer for first initialization');
    }
    lightingManagerInstance = new LightingManager(scene, renderer);
  }
  return lightingManagerInstance;
}
