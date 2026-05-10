/**
 * Scene Manager
 *
 * Wraps the active `THREE.Scene` plus a model-id-keyed registry so other
 * code can add / remove / look up models without prop-drilling
 * `sceneRef.current` from VRMViewer. Mirrors the singleton pattern used by
 * `cameraManager` and `lightingManager`: VRMViewer creates the scene, hands
 * it to `initializeSceneManager(scene)` once the canvas mounts, and tears
 * the singleton down on unmount.
 */

import * as THREE from 'three';

export class SceneManager {
  private scene: THREE.Scene;
  private models: Map<string, THREE.Group> = new Map();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  /**
   * Get the wrapped scene.
   */
  getScene(): THREE.Scene {
    return this.scene;
  }

  /**
   * Add a model to the scene under the given id. If a model with that id
   * already exists it is removed first.
   */
  addModel(id: string, model: THREE.Group): void {
    this.removeModel(id);
    this.models.set(id, model);
    this.scene.add(model);
  }

  /**
   * Remove a model by id. No-op if the id is not registered.
   */
  removeModel(id: string): void {
    const model = this.models.get(id);
    if (model) {
      this.scene.remove(model);
      this.models.delete(id);
    }
  }

  getModel(id: string): THREE.Group | undefined {
    return this.models.get(id);
  }

  getAllModels(): Map<string, THREE.Group> {
    return new Map(this.models);
  }

  /**
   * Remove every registered model from the scene. Lights and other
   * non-model children are left intact so the viewer doesn't go black.
   */
  clearModels(): void {
    this.models.forEach((model) => {
      this.scene.remove(model);
    });
    this.models.clear();
  }

  /**
   * Disposal — clears the registry but does NOT touch lights or other
   * scene children. The caller (VRMViewer) owns the scene's lifetime.
   */
  dispose(): void {
    this.clearModels();
  }
}

// Singleton — populated by `initializeSceneManager` from VRMViewer.
export let sceneManager: SceneManager | null = null;

export function initializeSceneManager(scene: THREE.Scene): SceneManager {
  if (!sceneManager) {
    sceneManager = new SceneManager(scene);
  }
  return sceneManager;
}

export function disposeSceneManager(): void {
  if (sceneManager) {
    sceneManager.dispose();
    sceneManager = null;
  }
}
