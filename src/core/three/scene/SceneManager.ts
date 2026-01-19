/**
 * Scene Manager
 * Manages Three.js scene, including initialization and model management
 */

import * as THREE from 'three';

/**
 * Scene Manager Class
 */
export class SceneManager {
  private scene: THREE.Scene;
  private renderer: THREE.WebGLRenderer;
  private camera: THREE.PerspectiveCamera;
  private models: Map<string, THREE.Group> = new Map();

  constructor(canvas?: HTMLCanvasElement) {
    // Initialize scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);

    // Initialize renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
    });

    if (canvas) {
      this.renderer.setSize(canvas.clientWidth, canvas.clientHeight);
      this.renderer.setPixelRatio(window.devicePixelRatio);
    } else {
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.renderer.setPixelRatio(window.devicePixelRatio);
    }

    // Initialize camera
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.camera.position.set(0, 1.5, 3);
    this.camera.lookAt(0, 1, 0);

    // Enable shadows
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Handle window resize
    window.addEventListener('resize', this.handleResize);
  }

  /**
   * Get scene
   */
  getScene(): THREE.Scene {
    return this.scene;
  }

  /**
   * Get renderer
   */
  getRenderer(): THREE.WebGLRenderer {
    return this.renderer;
  }

  /**
   * Add model to scene
   */
  addModel(id: string, model: THREE.Group): void {
    // Remove existing model with same ID
    this.removeModel(id);

    // Add new model
    this.models.set(id, model);
    this.scene.add(model);
  }

  /**
   * Remove model from scene
   */
  removeModel(id: string): void {
    const model = this.models.get(id);
    
    if (model) {
      this.scene.remove(model);
      this.models.delete(id);
    }
  }

  /**
   * Get model by ID
   */
  getModel(id: string): THREE.Group | undefined {
    return this.models.get(id);
  }

  /**
   * Get all models
   */
  getAllModels(): Map<string, THREE.Group> {
    return new Map(this.models);
  }

  /**
   * Clear all models from scene
   */
  clearModels(): void {
    this.models.forEach((model) => {
      this.scene.remove(model);
    });
    this.models.clear();
  }

  /**
   * Update scene
   */
  update(): void {
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Handle window resize
   */
  private handleResize = (): void => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(window.devicePixelRatio);
  }

  /**
   * Dispose scene and renderer
   */
  dispose(): void {
    this.clearModels();
    this.renderer.dispose();
    // Scene doesn't have a dispose method, just clear it
    this.scene.clear();
    
    window.removeEventListener('resize', this.handleResize);
  }
}

/**
 * Create singleton instance
 */
export const sceneManager = new SceneManager();
