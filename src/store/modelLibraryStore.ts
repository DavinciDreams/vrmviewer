/**
 * Model Library Store
 * Zustand store for managing user's model library with persistence
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { ModelRecord } from '../types/database.types';

/**
 * Model Library State
 */
interface ModelLibraryState {
  // Library data
  models: ModelRecord[];
  selectedModelId: string | null;
  selectedModelUuid: string | null;

  // Loading state
  isLoading: boolean;
  isRefreshing: boolean;

  // Error state
  error: string | null;

  // Filter state
  filters: {
    search: string;
    category: string | null;
    format: string | null;
    tags: string[];
  };

  // View state
  viewMode: 'grid' | 'list';
  sortBy: 'name' | 'createdAt' | 'updatedAt' | 'size';
  sortOrder: 'asc' | 'desc';
}

/**
 * Model Library Actions
 */
interface ModelLibraryActions {
  // Model management
  setModels: (models: ModelRecord[]) => void;
  addModel: (model: ModelRecord) => void;
  updateModel: (uuid: string, updates: Partial<ModelRecord>) => void;
  removeModel: (uuid: string) => void;
  clearModels: () => void;

  // Selection
  selectModel: (id: string | null, uuid: string | null) => void;
  clearSelection: () => void;

  // Loading state
  setLoading: (loading: boolean) => void;
  setRefreshing: (refreshing: boolean) => void;

  // Error handling
  setError: (error: string | null) => void;
  clearError: () => void;

  // Filters
  setFilters: (filters: Partial<ModelLibraryState['filters']>) => void;
  resetFilters: () => void;

  // View
  setViewMode: (mode: 'grid' | 'list') => void;
  setSortBy: (sortBy: 'name' | 'createdAt' | 'updatedAt' | 'size') => void;
  setSortOrder: (order: 'asc' | 'desc') => void;
}

/**
 * Create model library store
 */
export const useModelLibraryStore = create<ModelLibraryState & ModelLibraryActions>()(
  devtools(
    persist(
      (set) => ({
        // Initial state
        models: [],
        selectedModelId: null,
        selectedModelUuid: null,
        isLoading: false,
        isRefreshing: false,
        error: null,
        filters: {
          search: '',
          category: null,
          format: null,
          tags: [],
        },
        viewMode: 'grid',
        sortBy: 'createdAt',
        sortOrder: 'desc',

        // Actions
        setModels: (models: ModelRecord[]) =>
          set({
            models,
            isLoading: false,
            error: null,
          }),

        addModel: (model: ModelRecord) =>
          set((state) => ({
            models: [...state.models, model],
          })),

        updateModel: (uuid: string, updates: Partial<ModelRecord>) =>
          set((state) => ({
            models: state.models.map((model: ModelRecord) =>
              model.uuid === uuid ? { ...model, ...updates } : model
            ),
          })),

        removeModel: (uuid: string) =>
          set((state) => ({
            models: state.models.filter((model: ModelRecord) => model.uuid !== uuid),
            selectedModelId:
              state.selectedModelUuid === uuid ? null : state.selectedModelId,
            selectedModelUuid:
              state.selectedModelUuid === uuid ? null : state.selectedModelUuid,
          })),

        clearModels: () =>
          set({
            models: [],
            selectedModelId: null,
            selectedModelUuid: null,
          }),

        selectModel: (id: string | null, uuid: string | null) =>
          set({
            selectedModelId: id,
            selectedModelUuid: uuid,
          }),

        clearSelection: () =>
          set({
            selectedModelId: null,
            selectedModelUuid: null,
          }),

        setLoading: (loading: boolean) =>
          set({
            isLoading: loading,
          }),

        setRefreshing: (refreshing: boolean) =>
          set({
            isRefreshing: refreshing,
          }),

        setError: (error: string | null) =>
          set({
            error,
            isLoading: false,
            isRefreshing: false,
          }),

        clearError: () =>
          set({
            error: null,
          }),

        setFilters: (filters: Partial<ModelLibraryState['filters']>) =>
          set((state) => ({
            filters: { ...state.filters, ...filters },
          })),

        resetFilters: () =>
          set({
            filters: {
              search: '',
              category: null,
              format: null,
              tags: [],
            },
          }),

        setViewMode: (mode: 'grid' | 'list') =>
          set({
            viewMode: mode,
          }),

        setSortBy: (sortBy: 'name' | 'createdAt' | 'updatedAt' | 'size') =>
          set({
            sortBy,
          }),

        setSortOrder: (order: 'asc' | 'desc') =>
          set({
            sortOrder: order,
          }),
      }),
      {
        name: 'model-library-storage',
        // Persist models, filters, and view settings
        partialize: (state) => ({
          models: state.models,
          filters: state.filters,
          viewMode: state.viewMode,
          sortBy: state.sortBy,
          sortOrder: state.sortOrder,
        }),
      }
    ),
    {
      name: 'model-library',
    }
  )
);

/**
 * Selectors
 */

/**
 * Get filtered and sorted models
 */
export const selectFilteredModels = (state: ModelLibraryState): ModelRecord[] => {
  let filtered = [...state.models];

  // Apply search filter
  if (state.filters.search) {
    const searchLower = state.filters.search.toLowerCase();
    filtered = filtered.filter(
      (model) =>
        model.name.toLowerCase().includes(searchLower) ||
        model.displayName.toLowerCase().includes(searchLower) ||
        model.description?.toLowerCase().includes(searchLower)
    );
  }

  // Apply category filter
  if (state.filters.category) {
    filtered = filtered.filter((model) => model.category === state.filters.category);
  }

  // Apply format filter
  if (state.filters.format) {
    filtered = filtered.filter((model) => model.format === state.filters.format);
  }

  // Apply tags filter
  if (state.filters.tags.length > 0) {
    filtered = filtered.filter((model) =>
      state.filters.tags.some((tag) => model.tags.includes(tag))
    );
  }

  // Apply sorting
  filtered.sort((a, b) => {
    let comparison = 0;

    switch (state.sortBy) {
      case 'name':
        comparison = a.name.localeCompare(b.name);
        break;
      case 'createdAt':
        comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        break;
      case 'updatedAt':
        comparison = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
        break;
      case 'size':
        comparison = a.size - b.size;
        break;
    }

    return state.sortOrder === 'asc' ? comparison : -comparison;
  });

  return filtered;
};

/**
 * Get selected model
 */
export const selectSelectedModel = (state: ModelLibraryState): ModelRecord | null => {
  if (!state.selectedModelUuid) {
    return null;
  }
  return state.models.find((model) => model.uuid === state.selectedModelUuid) || null;
};

/**
 * Get model count
 */
export const selectModelCount = (state: ModelLibraryState): number => {
  return state.models.length;
};

/**
 * Get unique categories
 */
export const selectUniqueCategories = (state: ModelLibraryState): string[] => {
  const categories = new Set(
    state.models.map((model) => model.category).filter((cat): cat is string => cat !== undefined)
  );
  return Array.from(categories);
};

/**
 * Get unique tags
 */
export const selectUniqueTags = (state: ModelLibraryState): string[] => {
  const tags = new Set(state.models.flatMap((model) => model.tags));
  return Array.from(tags);
};

/**
 * Get library statistics
 */
export const selectLibraryStatistics = (state: ModelLibraryState): {
  totalModels: number;
  totalSize: number;
  formats: Record<string, number>;
} => {
  const formats: Record<string, number> = {};

  for (const model of state.models) {
    formats[model.format] = (formats[model.format] || 0) + 1;
  }

  return {
    totalModels: state.models.length,
    totalSize: state.models.reduce((sum, model) => sum + model.size, 0),
    formats,
  };
};
