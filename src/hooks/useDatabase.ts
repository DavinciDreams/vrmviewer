/**
 * useDatabase Hook
 * Provides access to database functionality
 */

import { useState, useEffect } from 'react';
import { getAnimationService } from '../core/database/services/AnimationService';
import { getModelService } from '../core/database/services/ModelService';
import { getDatabaseService } from '../core/database/DatabaseService';
import {
  AnimationRecord,
  ModelRecord,
  DatabaseOperationResult,
  DatabaseQueryOptions,
  DatabaseQueryResult,
} from '../../types/database.types';

/**
 * useDatabase Hook
 * Provides access to database functionality
 */
export function useDatabase() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [animationService, setAnimationService] = useState<ReturnType<typeof getAnimationService> | null>(null);
  const [modelService, setModelService] = useState<ReturnType<typeof getModelService> | null>(null);
  const [dbService] = getDatabaseService();

  // Initialize database on mount
  useEffect(() => {
    const init = async () => {
      try {
        await dbService.initialize();
        await animationService.initialize();
        await modelService.initialize();

        setIsInitialized(true);
      } catch (error) {
        console.error('Failed to initialize database:', error);
      }
    };

    init();
  }, []);

  /**
   * Get all animations
   */
  const getAllAnimations = async (options?: DatabaseQueryOptions) => {
    await animationService.initialize();
    const result = await animationService.getAllAnimations();

    if (options) {
      return animationService.filterAnimations(options);
    }

    return result;
  };

  /**
   * Get animation by ID
   */
  const getAnimationById = async (id: number) => {
    await animationService.initialize();
    return await animationService.loadAnimationById(id);
  };

  /**
   * Get animation by UUID
   */
  const getAnimationByUuid = async (uuid: string) => {
    await animationService.initialize();
    return await animationService.loadAnimation(uuid);
  };

  /**
   * Save animation
   */
  const saveAnimation = async (
    animation: Omit<AnimationRecord, 'id' | 'uuid' | 'createdAt' | 'updatedAt'>,
    thumbnail?: string
  ) => {
    await animationService.initialize();
    return await animationService.saveAnimation(animation, thumbnail);
  };

  /**
   * Delete animation
   */
  const deleteAnimation = async (uuid: string) => {
    await animationService.initialize();
    return await animationService.deleteAnimation(uuid);
  };

  /**
   * Search animations
   */
  const searchAnimations = async (query: string) => {
    await animationService.initialize();
    return await animationService.searchAnimations(query);
  };

  /**
   * Filter animations
   */
  const filterAnimations = async (options: DatabaseQueryOptions) => {
    await animationService.initialize();
    return await animationService.filterAnimations(options);
  };

  /**
   * Get animation count
   */
  const getAnimationCount = async () => {
    await animationService.initialize();
    return await animationService.getAnimationCount();
  };

  /**
   * Get unique categories
   */
  const getUniqueAnimationCategories = async () => {
    await animationService.initialize();
    return await animationService.getUniqueCategories();
  };

  /**
   * Get unique tags
   */
  const getUniqueAnimationTags = async () => {
    await animationService.initialize();
    return await animationService.getUniqueTags();
  };

  /**
   * Get recent animations
   */
  const getRecentAnimations = async (limit = 10) => {
    await animationService.initialize();
    return await animationService.getRecentAnimations(limit);
  };

  /**
   * Get all models
   */
  const getAllModels = async (options?: DatabaseQueryOptions) => {
    await modelService.initialize();
    const result = await modelService.getAllModels();

    if (options) {
      return modelService.filterModels(options);
    }

    return result;
  };

  /**
   * Get model by ID
   */
  const getModelById = async (id: number) => {
    await modelService.initialize();
    return await modelService.loadModelById(id);
  };

  /**
   * Get model by UUID
   */
  const getModelByUuid = async (uuid: string) => {
    await modelService.initialize();
    return await modelService.loadModel(uuid);
  };

  /**
   * Save model
   */
  const saveModel = async (
    model: Omit<ModelRecord, 'id' | 'uuid' | 'createdAt' | 'updatedAt'>,
    thumbnail?: string
  ) => {
    await modelService.initialize();
    return await modelService.saveModel(model, thumbnail);
  };

  /**
   * Delete model
   */
  const deleteModel = async (uuid: string) => {
    await modelService.initialize();
    return await modelService.deleteModel(uuid);
  };

  /**
   * Search models
   */
  const searchModels = async (query: string) => {
    await modelService.initialize();
    return await modelService.searchModels(query);
  };

  /**
   * Filter models
   */
  const filterModels = async (options: DatabaseQueryOptions) => {
    await modelService.initialize();
    return await modelService.filterModels(options);
  };

  /**
   * Get model count
   */
  const getModelCount = async () => {
    await modelService.initialize();
    return await modelService.getModelCount();
  };

  /**
   * Get unique categories
   */
  const getUniqueModelCategories = async () => {
    await modelService.initialize();
    return await modelService.getUniqueCategories();
  };

  /**
   * Get unique tags
   */
  const getUniqueModelTags = async () => {
    await modelService.initialize();
    return await modelService.getUniqueTags();
  };

  /**
   * Get recent models
   */
  const getRecentModels = async (limit = 10) => {
    await modelService.initialize();
    return await modelService.getRecentModels(limit);
  };

  /**
   * Check if animation exists
   */
  const animationExists = async (name: string) => {
    await animationService.initialize();
    return await animationService.animationExists(name);
  };

  /**
   * Check if model exists
   */
  const modelExists = async (name: string) => {
    await modelService.initialize();
    return await modelService.modelExists(name);
  };

  /**
   * Get database statistics
   */
  const getDatabaseStatistics = async () => {
    await dbService.initialize();
    return await dbService.getStatistics();
  };

  /**
   * Clear all animations
   */
  const clearAllAnimations = async () => {
    await animationService.initialize();
    return await animationService.clearAllAnimations();
  };

  /**
   * Clear all models
   */
  const clearAllModels = async () => {
    await modelService.initialize();
    return await modelService.clearAllModels();
  };

  /**
   * Clear all data
   */
  const clearAllData = async () => {
    await dbService.initialize();
    return await dbService.clearAll();
  };

  return {
    isInitialized,
    setIsInitialized,
    animations: {
      getAll: getAllAnimations,
      getById: getAnimationById,
      getByUuid: getAnimationByUuid,
      save: saveAnimation,
      delete: deleteAnimation,
      search: searchAnimations,
      filter: filterAnimations,
      count: getAnimationCount,
      getUniqueCategories: getUniqueAnimationCategories,
      getUniqueTags: getUniqueAnimationTags,
      getRecent: getRecentAnimations,
      exists: animationExists,
      clearAll: clearAllAnimations,
    },
    models: {
      getAll: getAllModels,
      getById: getModelById,
      getByUuid: getModelByUuid,
      save: saveModel,
      delete: deleteModel,
      search: searchModels,
      filter: filterModels,
      count: getModelCount,
      getUniqueCategories: getUniqueModelCategories,
      getUniqueTags: getUniqueModelTags,
      getRecent: getRecentModels,
      exists: modelExists,
      clearAll: clearAllModels,
    },
    statistics: {
      get: getDatabaseStatistics,
    },
    clearAll: clearAllData,
  };
}
