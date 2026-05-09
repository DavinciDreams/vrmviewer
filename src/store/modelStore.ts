/**
 * Model Store
 * Zustand store for model state management (format-agnostic)
 * Replaces VRM-centric vrmStore
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { Model } from '../types/model.types';

/**
 * Model Store State
 */
interface ModelStoreState {
  currentModel: Model | null;
  isLoading: boolean;
  error: string | null;
  metadata: {
    name: string;
    version: string;
    author: string;
    format?: string;
  } | null;
}

/**
 * Model Store Actions
 */
interface ModelStoreActions {
  setModel: (model: Model) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  setMetadata: (metadata: ModelStoreState['metadata']) => void;
  clearModel: () => void;
}

/**
 * Create Model store
 */
export const useModelStore = create<ModelStoreState & ModelStoreActions>()(
  devtools(
    (set) => ({
      // Initial state
      currentModel: null,
      isLoading: false,
      error: null,
      metadata: null,

      // Actions
      setModel: (model) =>
        set({
          currentModel: model,
          error: null,
        }),

      setLoading: (loading) =>
        set({
          isLoading: loading,
        }),

      setError: (error) =>
        set({
          error,
        }),

      clearError: () =>
        set({
          error: null,
        }),

      setMetadata: (metadata) =>
        set({
          metadata,
        }),

      clearModel: () =>
        set({
          currentModel: null,
          metadata: null,
          error: null,
        }),
    }),
    {
      name: 'model-storage',
    }
  )
);

/**
 * Backward compatibility alias for VRM store
 * @deprecated Use useModelStore instead
 */
export const useVRMStore = useModelStore;
