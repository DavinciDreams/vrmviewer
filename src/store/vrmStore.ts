/**
 * VRM Store
 * Zustand store for VRM model state management
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { VRMModel } from '../types/vrm.types';

/**
 * VRM Store State
 */
interface VRMStoreState {
  currentModel: VRMModel | null;
  isLoading: boolean;
  error: string | null;
  metadata: {
    name: string;
    version: string;
    author: string;
  } | null;
}

/**
 * VRM Store Actions
 */
interface VRMStoreActions {
  setModel: (model: VRMModel) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  setMetadata: (metadata: VRMStoreState['metadata']) => void;
  clearModel: () => void;
}

/**
 * Create VRM store
 */
export const useVRMStore = create<VRMStoreState & VRMStoreActions>()(
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
        }),
    }),
    {
      name: 'vrm-storage',
    }
  )
);
