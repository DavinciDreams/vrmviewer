/**
 * Animation Library Store
 * Zustand store for managing user's animation library with persistence
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { AnimationRecord } from '../types/database.types';

/**
 * Animation Library State
 */
interface AnimationLibraryState {
  // Library data
  animations: AnimationRecord[];
  selectedAnimationId: string | null;
  selectedAnimationUuid: string | null;

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
  sortBy: 'name' | 'createdAt' | 'updatedAt' | 'duration' | 'size';
  sortOrder: 'asc' | 'desc';
}

/**
 * Animation Library Actions
 */
interface AnimationLibraryActions {
  // Animation management
  setAnimations: (animations: AnimationRecord[]) => void;
  addAnimation: (animation: AnimationRecord) => void;
  updateAnimation: (uuid: string, updates: Partial<AnimationRecord>) => void;
  removeAnimation: (uuid: string) => void;
  clearAnimations: () => void;

  // Selection
  selectAnimation: (id: string | null, uuid: string | null) => void;
  clearSelection: () => void;

  // Loading state
  setLoading: (loading: boolean) => void;
  setRefreshing: (refreshing: boolean) => void;

  // Error handling
  setError: (error: string | null) => void;
  clearError: () => void;

  // Filters
  setFilters: (filters: Partial<AnimationLibraryState['filters']>) => void;
  resetFilters: () => void;

  // View
  setViewMode: (mode: 'grid' | 'list') => void;
  setSortBy: (sortBy: 'name' | 'createdAt' | 'updatedAt' | 'duration' | 'size') => void;
  setSortOrder: (order: 'asc' | 'desc') => void;
}

/**
 * Create animation library store
 */
export const useAnimationLibraryStore = create<AnimationLibraryState & AnimationLibraryActions>()(
  devtools(
    persist(
      (set) => ({
        // Initial state
        animations: [],
        selectedAnimationId: null,
        selectedAnimationUuid: null,
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
        setAnimations: (animations: AnimationRecord[]) =>
          set({
            animations,
            isLoading: false,
            error: null,
          }),

        addAnimation: (animation: AnimationRecord) =>
          set((state) => ({
            animations: [...state.animations, animation],
          })),

        updateAnimation: (uuid: string, updates: Partial<AnimationRecord>) =>
          set((state) => ({
            animations: state.animations.map((animation: AnimationRecord) =>
              animation.uuid === uuid ? { ...animation, ...updates } : animation
            ),
          })),

        removeAnimation: (uuid: string) =>
          set((state) => ({
            animations: state.animations.filter((animation: AnimationRecord) => animation.uuid !== uuid),
            selectedAnimationId:
              state.selectedAnimationUuid === uuid ? null : state.selectedAnimationId,
            selectedAnimationUuid:
              state.selectedAnimationUuid === uuid ? null : state.selectedAnimationUuid,
          })),

        clearAnimations: () =>
          set({
            animations: [],
            selectedAnimationId: null,
            selectedAnimationUuid: null,
          }),

        selectAnimation: (id: string | null, uuid: string | null) =>
          set({
            selectedAnimationId: id,
            selectedAnimationUuid: uuid,
          }),

        clearSelection: () =>
          set({
            selectedAnimationId: null,
            selectedAnimationUuid: null,
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

        setFilters: (filters: Partial<AnimationLibraryState['filters']>) =>
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

        setSortBy: (sortBy: 'name' | 'createdAt' | 'updatedAt' | 'duration' | 'size') =>
          set({
            sortBy,
          }),

        setSortOrder: (order: 'asc' | 'desc') =>
          set({
            sortOrder: order,
          }),
      }),
      {
        name: 'animation-library-storage',
        // Persist animations, filters, and view settings
        partialize: (state) => ({
          animations: state.animations,
          filters: state.filters,
          viewMode: state.viewMode,
          sortBy: state.sortBy,
          sortOrder: state.sortOrder,
        }),
      }
    ),
    {
      name: 'animation-library',
    }
  )
);

/**
 * Selectors
 */

/**
 * Get filtered and sorted animations
 */
export const selectFilteredAnimations = (state: AnimationLibraryState): AnimationRecord[] => {
  let filtered = [...state.animations];

  // Apply search filter
  if (state.filters.search) {
    const searchLower = state.filters.search.toLowerCase();
    filtered = filtered.filter(
      (animation) =>
        animation.name.toLowerCase().includes(searchLower) ||
        animation.displayName.toLowerCase().includes(searchLower) ||
        animation.description?.toLowerCase().includes(searchLower)
    );
  }

  // Apply category filter
  if (state.filters.category) {
    filtered = filtered.filter((animation) => animation.category === state.filters.category);
  }

  // Apply format filter
  if (state.filters.format) {
    filtered = filtered.filter((animation) => animation.format === state.filters.format);
  }

  // Apply tags filter
  if (state.filters.tags.length > 0) {
    filtered = filtered.filter((animation) =>
      state.filters.tags.some((tag) => animation.tags.includes(tag))
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
      case 'duration':
        comparison = a.duration - b.duration;
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
 * Get selected animation
 */
export const selectSelectedAnimation = (state: AnimationLibraryState): AnimationRecord | null => {
  if (!state.selectedAnimationUuid) {
    return null;
  }
  return state.animations.find((animation) => animation.uuid === state.selectedAnimationUuid) || null;
};

/**
 * Get animation count
 */
export const selectAnimationCount = (state: AnimationLibraryState): number => {
  return state.animations.length;
};

/**
 * Get unique categories
 */
export const selectUniqueCategories = (state: AnimationLibraryState): string[] => {
  const categories = new Set(
    state.animations.map((animation) => animation.category).filter((cat): cat is string => cat !== undefined && cat !== null && cat !== '')
  );
  return Array.from(categories);
};

/**
 * Get unique tags
 */
export const selectUniqueTags = (state: AnimationLibraryState): string[] => {
  const tags = new Set(state.animations.flatMap((animation) => animation.tags));
  return Array.from(tags);
};

/**
 * Get library statistics
 */
export const selectLibraryStatistics = (state: AnimationLibraryState): {
  totalAnimations: number;
  totalSize: number;
  totalDuration: number;
  formats: Record<string, number>;
} => {
  const formats: Record<string, number> = {};

  for (const animation of state.animations) {
    formats[animation.format] = (formats[animation.format] || 0) + 1;
  }

  return {
    totalAnimations: state.animations.length,
    totalSize: state.animations.reduce((sum, animation) => sum + animation.size, 0),
    totalDuration: state.animations.reduce((sum, animation) => sum + animation.duration, 0),
    formats,
  };
};
