/**
 * VRM Store
 * Zustand store for VRM model state management
 * Simplified to single model mode
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import * as THREE from 'three';
import { VRMModel } from '../types/vrm.types';

/**
 * Extended VRM model entry with runtime properties
 * Simplified for single model use
 */
export interface VRMModelEntry {
  id: string;
  model: VRMModel;
  position: THREE.Vector3;
  isVisible: boolean;
  isWireframe: boolean;
  scale: number;
  loadedAt: number;
  buffer?: ArrayBuffer;
}

/**
 * VRM Store State
 * Simplified for single model mode
 */
interface VRMStoreState {
  model: VRMModelEntry | null;
  modelId: string | null; // UUID from database when saved
  name: string;
  description: string;
  isLoading: boolean;
  loadingModelId: string | null;
  error: string | null;
}

/**
 * VRM Store Actions
 */
interface VRMStoreActions {
  // Model management
  setModel: (entry: VRMModelEntry) => void;
  clearModel: () => void;
  
  // Model properties
  setModelPosition: (position: THREE.Vector3) => void;
  setModelVisibility: (visible: boolean) => void;
  setModelWireframe: (wireframe: boolean) => void;
  setModelScale: (scale: number) => void;
  
  // Model metadata
  setName: (name: string) => void;
  setDescription: (description: string) => void;
  setModelId: (uuid: string | null) => void;
  
  // Loading state
  setLoading: (loading: boolean, modelId?: string) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  
  // Backward compatibility
  setModelFromVRM: (model: VRMModel) => void;
}

/**
 * Create VRM store
 */
export const useVRMStore = create<VRMStoreState & VRMStoreActions & { currentModel: VRMModel | null }>()(
  devtools(
    (set, get) => ({
      // Initial state
      model: null,
      modelId: null,
      name: '',
      description: '',
      isLoading: false,
      loadingModelId: null,
      error: null,
      
      // Backward compatibility: currentModel getter
      get currentModel() {
        const state = get();
        return state.model?.model || null;
      },

      // Model management
      setModel: (entry) =>
        set({
          model: entry,
          error: null,
        }),

      clearModel: () =>
        set({
          model: null,
          modelId: null,
          name: '',
          description: '',
          error: null,
        }),

      // Model properties
      setModelPosition: (position) =>
        set((state) => {
          if (!state.model) return state;
          return {
            model: { ...state.model, position },
          };
        }),

      setModelVisibility: (visible) =>
        set((state) => {
          if (!state.model) return state;
          return {
            model: { ...state.model, isVisible: visible },
          };
        }),

      setModelWireframe: (wireframe) =>
        set((state) => {
          if (!state.model) return state;
          return {
            model: { ...state.model, isWireframe: wireframe },
          };
        }),

      setModelScale: (scale) =>
        set((state) => {
          if (!state.model) return state;
          return {
            model: { ...state.model, scale },
          };
        }),

      // Model metadata
      setName: (name) =>
        set({ name }),

      setDescription: (description) =>
        set({ description }),

      setModelId: (uuid) =>
        set({ modelId: uuid }),

      // Loading state
      setLoading: (loading, modelId) =>
        set({
          isLoading: loading,
          loadingModelId: modelId || null,
        }),

      setError: (error) =>
        set({ error }),

      clearError: () =>
        set({ error: null }),

      // Backward compatibility
      setModelFromVRM: (model) =>
        set((state) => ({
          model: {
            id: crypto.randomUUID(),
            model,
            position: state.model?.position || new THREE.Vector3(0, 0, 0),
            isVisible: state.model?.isVisible ?? true,
            isWireframe: state.model?.isWireframe ?? false,
            scale: state.model?.scale ?? 1,
            loadedAt: Date.now(),
          },
          error: null,
        })),
    }),
    {
      name: 'vrm-storage',
    }
  )
);

/**
 * Backward compatibility: Get current model
 */
export const getCurrentModel = (): VRMModel | null => {
  return useVRMStore.getState().currentModel;
};
