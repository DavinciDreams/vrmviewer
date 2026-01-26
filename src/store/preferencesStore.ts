/**
 * Preferences Store
 * Zustand store for managing user preferences with IndexedDB persistence
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { getPreferencesService } from '../core/database/services/PreferencesService';

/**
 * Camera State
 */
interface CameraState {
  position: { x: number; y: number; z: number };
  target: { x: number; y: number; z: number };
  zoom: number;
}

/**
 * View Settings
 */
interface ViewSettings {
  modelViewMode: 'grid' | 'list';
  animationViewMode: 'grid' | 'list';
  modelSortBy: 'name' | 'createdAt' | 'updatedAt' | 'size';
  modelSortOrder: 'asc' | 'desc';
  animationSortBy: 'name' | 'createdAt' | 'updatedAt' | 'duration' | 'size';
  animationSortOrder: 'asc' | 'desc';
}

/**
 * Preferences State
 */
interface PreferencesState {
  // Camera state
  camera: CameraState;

  // View settings
  viewSettings: ViewSettings;

  // Loading state
  isLoading: boolean;

  // Error state
  error: string | null;
}

/**
 * Preferences Actions
 */
interface PreferencesActions {
  // Load/save methods
  loadPreferences: () => Promise<void>;
  savePreferences: () => Promise<void>;

  // Camera methods
  setCameraPosition: (position: { x: number; y: number; z: number }) => void;
  setCameraTarget: (target: { x: number; y: number; z: number }) => void;
  setCameraZoom: (zoom: number) => void;
  setCamera: (camera: CameraState) => void;

  // View settings methods
  setModelViewMode: (mode: 'grid' | 'list') => void;
  setAnimationViewMode: (mode: 'grid' | 'list') => void;
  setModelSortBy: (sortBy: 'name' | 'createdAt' | 'updatedAt' | 'size') => void;
  setModelSortOrder: (order: 'asc' | 'desc') => void;
  setAnimationSortBy: (sortBy: 'name' | 'createdAt' | 'updatedAt' | 'duration' | 'size') => void;
  setAnimationSortOrder: (order: 'asc' | 'desc') => void;
  setViewSettings: (settings: Partial<ViewSettings>) => void;

  // Loading and error
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
}

/**
 * Create preferences store
 */
export const usePreferencesStore = create<PreferencesState & PreferencesActions>()(
  devtools((set, get) => ({
    // Initial state
    camera: {
      position: { x: 0, y: 0, z: 0 },
      target: { x: 0, y: 0, z: 0 },
      zoom: 1,
    },
    viewSettings: {
      modelViewMode: 'grid',
      animationViewMode: 'grid',
      modelSortBy: 'createdAt',
      modelSortOrder: 'desc',
      animationSortBy: 'createdAt',
      animationSortOrder: 'desc',
    },
    isLoading: false,
    error: null,

    // Load/save methods
    loadPreferences: async () => {
      set({ isLoading: true, error: null });
      try {
        const preferencesService = getPreferencesService();
        const result = await preferencesService.getAllPreferences();
        
        if (result.success && result.data) {
          const prefs = result.data;
          set({
            camera: prefs.camera as CameraState || {
              position: { x: 0, y: 0, z: 0 },
              target: { x: 0, y: 0, z: 0 },
              zoom: 1,
            },
            viewSettings: prefs.viewSettings as ViewSettings || {
              modelViewMode: 'grid',
              animationViewMode: 'grid',
              modelSortBy: 'createdAt',
              modelSortOrder: 'desc',
              animationSortBy: 'createdAt',
              animationSortOrder: 'desc',
            },
            isLoading: false,
            error: null,
          });
        } else {
          set({ isLoading: false, error: null });
        }
      } catch (error) {
        set({ error: 'Failed to load preferences', isLoading: false });
        console.error('Error loading preferences:', error);
      }
    },

    savePreferences: async () => {
      set({ isLoading: true, error: null });
      try {
        const state = get();
        const preferencesService = getPreferencesService();
        
        await preferencesService.setPreference('camera', state.camera);
        await preferencesService.setPreference('viewSettings', state.viewSettings);
        
        set({ isLoading: false, error: null });
      } catch (error) {
        set({ error: 'Failed to save preferences', isLoading: false });
        console.error('Error saving preferences:', error);
      }
    },

    // Camera methods
    setCameraPosition: (position) =>
      set((state) => ({
        camera: {
          ...state.camera,
          position,
        },
      })),

    setCameraTarget: (target) =>
      set((state) => ({
        camera: {
          ...state.camera,
          target,
        },
      })),

    setCameraZoom: (zoom) =>
      set((state) => ({
        camera: {
          ...state.camera,
          zoom,
        },
      })),

    setCamera: (camera) =>
      set({
        camera,
      }),

    // View settings methods
    setModelViewMode: (mode) =>
      set((state) => ({
        viewSettings: {
          ...state.viewSettings,
          modelViewMode: mode,
        },
      })),

    setAnimationViewMode: (mode) =>
      set((state) => ({
        viewSettings: {
          ...state.viewSettings,
          animationViewMode: mode,
        },
      })),

    setModelSortBy: (sortBy) =>
      set((state) => ({
        viewSettings: {
          ...state.viewSettings,
          modelSortBy: sortBy,
        },
      })),

    setModelSortOrder: (order) =>
      set((state) => ({
        viewSettings: {
          ...state.viewSettings,
          modelSortOrder: order,
        },
      })),

    setAnimationSortBy: (sortBy) =>
      set((state) => ({
        viewSettings: {
          ...state.viewSettings,
          animationSortBy: sortBy,
        },
      })),

    setAnimationSortOrder: (order) =>
      set((state) => ({
        viewSettings: {
          ...state.viewSettings,
          animationSortOrder: order,
        },
      })),

    setViewSettings: (settings) =>
      set((state) => ({
        viewSettings: {
          ...state.viewSettings,
          ...settings,
        },
      })),

    // Loading and error
    setLoading: (loading) =>
      set({
        isLoading: loading,
      }),

    setError: (error) =>
      set({
        error,
        isLoading: false,
      }),

    clearError: () =>
      set({
        error: null,
      }),
  }))
);

/**
 * Selectors
 */

/**
 * Get camera state
 */
export const selectCamera = (state: PreferencesState): CameraState => {
  return state.camera;
};

/**
 * Get camera position
 */
export const selectCameraPosition = (state: PreferencesState): { x: number; y: number; z: number } => {
  return state.camera.position;
};

/**
 * Get camera target
 */
export const selectCameraTarget = (state: PreferencesState): { x: number; y: number; z: number } => {
  return state.camera.target;
};

/**
 * Get camera zoom
 */
export const selectCameraZoom = (state: PreferencesState): number => {
  return state.camera.zoom;
};

/**
 * Get view settings
 */
export const selectViewSettings = (state: PreferencesState): ViewSettings => {
  return state.viewSettings;
};

/**
 * Get model view mode
 */
export const selectModelViewMode = (state: PreferencesState): 'grid' | 'list' => {
  return state.viewSettings.modelViewMode;
};

/**
 * Get animation view mode
 */
export const selectAnimationViewMode = (state: PreferencesState): 'grid' | 'list' => {
  return state.viewSettings.animationViewMode;
};
