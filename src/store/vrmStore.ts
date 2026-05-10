/**
 * VRM Store
 * Zustand store for VRM model state management
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { VRMModel } from '../types/vrm.types';
import type { ExtractedBundle } from '../core/database/services/ModelService';

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
  /** Extracted metadata bundle, populated after successful load. Cleared on clearModel. */
  extractedBundle: ExtractedBundle | null;
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
  setExtractedBundle: (bundle: ExtractedBundle | null) => void;
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
      extractedBundle: null,

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

      setExtractedBundle: (bundle) =>
        set({
          extractedBundle: bundle,
        }),

      clearModel: () =>
        set({
          currentModel: null,
          metadata: null,
          extractedBundle: null,
        }),
    }),
    {
      name: 'vrm-storage',
    }
  )
);
