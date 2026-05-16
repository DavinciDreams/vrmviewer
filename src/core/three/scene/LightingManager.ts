/**
 * Lighting Manager
 * Manages Three.js lighting setup for the 3D scene
 */

import * as THREE from 'three';

export type LightingPreviewMode = 'standard' | 'studio';

const STANDARD_BACKGROUND = 0x1a1a2e;
const STUDIO_BACKGROUND = 0xf4f4ef;

/**
 * Lighting Manager Class
 */
export class LightingManager {
  private scene: THREE.Scene;
  private ambientLight: THREE.AmbientLight;
  private hemisphereLight: THREE.HemisphereLight;
  private directionalLight: THREE.DirectionalLight;
  private fillLight: THREE.DirectionalLight;
  private rimLight?: THREE.DirectionalLight;
  private renderer: THREE.WebGLRenderer;
  private previewMode: LightingPreviewMode = 'studio';
  private isWhiteBackground = true;

  constructor(scene: THREE.Scene, renderer: THREE.WebGLRenderer) {
    this.scene = scene;
    this.renderer = renderer;

    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    this.scene.add(this.ambientLight);

    this.hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x445566, 0.7);
    this.scene.add(this.hemisphereLight);

    this.directionalLight = new THREE.DirectionalLight(0xffffff, 1.6);
    this.directionalLight.position.set(5, 10, 7.5);
    this.directionalLight.castShadow = true;
    this.directionalLight.shadow.mapSize.width = 2048;
    this.directionalLight.shadow.mapSize.height = 2048;
    this.directionalLight.shadow.camera.near = 0.1;
    this.directionalLight.shadow.camera.far = 50;
    this.directionalLight.shadow.bias = -0.0001;
    this.scene.add(this.directionalLight);

    this.fillLight = new THREE.DirectionalLight(0xdde8ff, 0.55);
    this.fillLight.position.set(-4, 3, -5);
    this.scene.add(this.fillLight);

    // Enable shadows in renderer
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.35;
    this.setPreviewMode('studio');
    this.applyBackground();
  }

  /**
   * True when this singleton still owns the active scene/renderer pair.
   * React StrictMode and Vite HMR can briefly create a fresh scene while the
   * previous manager instance is still around.
   */
  isAttachedTo(scene: THREE.Scene, renderer: THREE.WebGLRenderer): boolean {
    return this.scene === scene && this.renderer === renderer;
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
   * Get current preview preset.
   */
  getPreviewMode(): LightingPreviewMode {
    return this.previewMode;
  }

  /**
   * Whether the scene is using a light studio background.
   */
  getWhiteBackgroundEnabled(): boolean {
    return this.isWhiteBackground;
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
   * Apply a named preview preset. Studio is intentionally bright for asset
   * inspection, especially generated foliage with low-luminance albedo maps.
   */
  setPreviewMode(mode: LightingPreviewMode): void {
    this.previewMode = mode;

    if (mode === 'studio') {
      this.ambientLight.intensity = 2.0;
      this.hemisphereLight.intensity = 1.35;
      this.directionalLight.intensity = 3.0;
      this.fillLight.intensity = 1.4;
      this.renderer.toneMappingExposure = 1.9;
      this.isWhiteBackground = true;
    } else {
      this.ambientLight.intensity = 0.9;
      this.hemisphereLight.intensity = 0.7;
      this.directionalLight.intensity = 1.6;
      this.fillLight.intensity = 0.55;
      this.renderer.toneMappingExposure = 1.35;
      this.isWhiteBackground = false;
    }

    this.applyBackground();
  }

  /**
   * Toggle the light background independently from the lighting preset.
   */
  setWhiteBackgroundEnabled(enabled: boolean): void {
    this.isWhiteBackground = enabled;
    this.applyBackground();
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

  private applyBackground(): void {
    this.scene.background = new THREE.Color(this.isWhiteBackground ? STUDIO_BACKGROUND : STANDARD_BACKGROUND);
    this.renderer.setClearColor(this.scene.background);
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
    this.scene.remove(this.hemisphereLight);
    this.scene.remove(this.directionalLight);
    this.scene.remove(this.fillLight);
    
    if (this.rimLight) {
      this.scene.remove(this.rimLight);
      this.rimLight = undefined;
    }

    // Note: THREE.DirectionalLight doesn't have a dispose method
    // Only the renderer needs to be disposed
  }
}

// Singleton instance — initialised by VRMViewer when the canvas mounts.
// This mirrors the `cameraManager` pattern so other UI (LightingPanel) can
// access the active manager without prop-drilling.
export let lightingManager: LightingManager | null = null;

export function initializeLightingManager(
  scene: THREE.Scene,
  renderer: THREE.WebGLRenderer,
): LightingManager {
  if (lightingManager && !lightingManager.isAttachedTo(scene, renderer)) {
    lightingManager.dispose();
    lightingManager = null;
  }

  if (!lightingManager) {
    lightingManager = new LightingManager(scene, renderer);
  }
  return lightingManager;
}

export function disposeLightingManager(): void {
  if (lightingManager) {
    lightingManager.dispose();
    lightingManager = null;
  }
}
