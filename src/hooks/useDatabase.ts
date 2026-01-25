/**
 * useDatabase Hook
 * Provides access to database functionality
 */

import { useState, useEffect, useMemo } from 'react';
import { getAnimationService } from '../core/database/services/AnimationService';
import { getModelService } from '../core/database/services/ModelService';
import { getDatabaseService } from '../core/database/DatabaseService';
import {
  AnimationRecord,
  ModelRecord,
  DatabaseQueryOptions,
} from '../types/database.types';

/**
 * useDatabase Hook
 * Provides access to database functionality
 */
export function useDatabase() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [animationService, setAnimationService] = useState<ReturnType<typeof getAnimationService> | null>(null);
  const [modelService, setModelService] = useState<ReturnType<typeof getModelService> | null>(null);
  // Store database service instance directly (not destructured as array)
  const dbService = getDatabaseService();

  // Initialize database on mount
  useEffect(() => {
    const init = async () => {
      try {
        const animSvc = getAnimationService();
        const modSvc = getModelService();
        
        await dbService.initialize();
        await animSvc.initialize();
        await modSvc.initialize();

        setAnimationService(animSvc);
        setModelService(modSvc);
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
    const svc = animationService;
    if (!svc) return { success: false, error: { type: 'UNKNOWN', message: 'Animation service not initialized' }, data: undefined };
    await svc.initialize();
    const result = await svc.getAllAnimations();

    if (options) {
      return svc.filterAnimations(options);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return result as any;
  };

  /**
   * Get animation by ID
   */
  const getAnimationById = async (id: number) => {
    const svc = animationService;
    if (!svc) return { success: false, error: { type: 'UNKNOWN', message: 'Animation service not initialized' }, data: undefined };
    await svc.initialize();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return await svc.loadAnimationById(id) as any;
  };

  /**
   * Get animation by UUID
   */
  const getAnimationByUuid = async (uuid: string) => {
    const svc = animationService;
    if (!svc) return { success: false, error: { type: 'UNKNOWN', message: 'Animation service not initialized' }, data: undefined };
    await svc.initialize();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return await svc.loadAnimation(uuid) as any;
  };

  /**
   * Save animation
   */
  const saveAnimation = async (
    animation: Omit<AnimationRecord, 'id' | 'uuid' | 'createdAt' | 'updatedAt'>,
    thumbnail?: string
  ) => {
    const svc = animationService;
    if (!svc) return { success: false, error: { type: 'UNKNOWN', message: 'Animation service not initialized' }, data: undefined };
    await svc.initialize();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return await svc.saveAnimation(animation, thumbnail) as any;
  };

  /**
   * Delete animation
   */
  const deleteAnimation = async (uuid: string) => {
    const svc = animationService;
    if (!svc) return { success: false, error: { type: 'UNKNOWN', message: 'Animation service not initialized' } };
    await svc.initialize();
    return await svc.deleteAnimation(uuid);
  };

  /**
   * Search animations
   */
  const searchAnimations = async (query: string) => {
    const svc = animationService;
    if (!svc) return { success: false, error: { type: 'UNKNOWN', message: 'Animation service not initialized' } };
    await svc.initialize();
    return await svc.searchAnimations(query);
  };

  /**
   * Filter animations
   */
  const filterAnimations = async (options: DatabaseQueryOptions) => {
    const svc = animationService;
    if (!svc) return { success: false, error: { type: 'UNKNOWN', message: 'Animation service not initialized' } };
    await svc.initialize();
    return await svc.filterAnimations(options);
  };

  /**
   * Get animation count
   */
  const getAnimationCount = async () => {
    const svc = animationService;
    if (!svc) return { success: false, error: { type: 'UNKNOWN', message: 'Animation service not initialized' } };
    await svc.initialize();
    return await svc.getAnimationCount();
  };

  /**
   * Get unique categories
   */
  const getUniqueAnimationCategories = async () => {
    const svc = animationService;
    if (!svc) return { success: false, error: { type: 'UNKNOWN', message: 'Animation service not initialized' } };
    await svc.initialize();
    return await svc.getUniqueCategories();
  };

  /**
   * Get unique tags
   */
  const getUniqueAnimationTags = async () => {
    const svc = animationService;
    if (!svc) return { success: false, error: { type: 'UNKNOWN', message: 'Animation service not initialized' } };
    await svc.initialize();
    return await svc.getUniqueTags();
  };

  /**
   * Get recent animations
   */
  const getRecentAnimations = async (limit = 10) => {
    const svc = animationService;
    if (!svc) return { success: false, error: { type: 'UNKNOWN', message: 'Animation service not initialized' } };
    await svc.initialize();
    return await svc.getRecentAnimations(limit);
  };

  /**
   * Check if animation exists
   */
  const animationExists = async (name: string) => {
    const svc = animationService;
    if (!svc) return { success: false, error: { type: 'UNKNOWN', message: 'Animation service not initialized' } };
    await svc.initialize();
    return await svc.animationExists(name);
  };

  /**
   * Clear all animations
   */
  const clearAllAnimations = async () => {
    const svc = animationService;
    if (!svc) return { success: false, error: { type: 'UNKNOWN', message: 'Animation service not initialized' } };
    await svc.initialize();
    return await svc.clearAllAnimations();
  };

  /**
   * Get all models
   */
  const getAllModels = async (options?: DatabaseQueryOptions) => {
    const svc = modelService;
    if (!svc) return { success: false, error: { type: 'UNKNOWN', message: 'Model service not initialized' } };
    await svc.initialize();
    const result = await svc.getAllModels();

    if (options) {
      return svc.filterModels(options);
    }

    return result;
  };

  /**
   * Get model by ID
   */
  const getModelById = async (id: number) => {
    const svc = modelService;
    if (!svc) return { success: false, error: { type: 'UNKNOWN', message: 'Model service not initialized' } };
    await svc.initialize();
    return await svc.loadModelById(id);
  };

  /**
   * Get model by UUID
   */
  const getModelByUuid = async (uuid: string) => {
    const svc = modelService;
    if (!svc) return { success: false, error: { type: 'UNKNOWN', message: 'Model service not initialized' } };
    await svc.initialize();
    return await svc.loadModel(uuid);
  };

  /**
   * Save model
   */
  const saveModel = async (
    model: Omit<ModelRecord, 'id' | 'uuid' | 'createdAt' | 'updatedAt'>,
    thumbnail?: string
  ) => {
    const svc = modelService;
    if (!svc) return { success: false, error: { type: 'UNKNOWN', message: 'Model service not initialized' } };
    await svc.initialize();
    return await svc.saveModel(model, thumbnail);
  };

  /**
   * Delete model
   */
  const deleteModel = async (uuid: string) => {
    const svc = modelService;
    if (!svc) return { success: false, error: { type: 'UNKNOWN', message: 'Model service not initialized' } };
    await svc.initialize();
    return await svc.deleteModel(uuid);
  };

  /**
   * Search models
   */
  const searchModels = async (query: string) => {
    const svc = modelService;
    if (!svc) return { success: false, error: { type: 'UNKNOWN', message: 'Model service not initialized' } };
    await svc.initialize();
    return await svc.searchModels(query);
  };

  /**
   * Filter models
   */
  const filterModels = async (options: DatabaseQueryOptions) => {
    const svc = modelService;
    if (!svc) return { success: false, error: { type: 'UNKNOWN', message: 'Model service not initialized' } };
    await svc.initialize();
    return await svc.filterModels(options);
  };

  /**
   * Get model count
   */
  const getModelCount = async () => {
    const svc = modelService;
    if (!svc) return { success: false, error: { type: 'UNKNOWN', message: 'Model service not initialized' } };
    await svc.initialize();
    return await svc.getModelCount();
  };

  /**
   * Get unique categories
   */
  const getUniqueModelCategories = async () => {
    const svc = modelService;
    if (!svc) return { success: false, error: { type: 'UNKNOWN', message: 'Model service not initialized' } };
    await svc.initialize();
    return await svc.getUniqueCategories();
  };

  /**
   * Get unique tags
   */
  const getUniqueModelTags = async () => {
    const svc = modelService;
    if (!svc) return { success: false, error: { type: 'UNKNOWN', message: 'Model service not initialized' } };
    await svc.initialize();
    return await svc.getUniqueTags();
  };

  /**
   * Get recent models
   */
  const getRecentModels = async (limit = 10) => {
    const svc = modelService;
    if (!svc) return { success: false, error: { type: 'UNKNOWN', message: 'Model service not initialized' } };
    await svc.initialize();
    return await svc.getRecentModels(limit);
  };

  /**
   * Check if model exists
   */
  const modelExists = async (name: string) => {
    const svc = modelService;
    if (!svc) return { success: false, error: { type: 'UNKNOWN', message: 'Model service not initialized' } };
    await svc.initialize();
    return await svc.modelExists(name);
  };

  /**
   * Clear all models
   */
  const clearAllModels = async () => {
    const svc = modelService;
    if (!svc) return { success: false, error: { type: 'UNKNOWN', message: 'Model service not initialized' } };
    await svc.initialize();
    return await svc.clearAllModels();
  };

  /**
   * Get database statistics
   */
  const getDatabaseStatistics = async () => {
    await dbService.initialize();
    return await dbService.getStatistics();
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
    animations: useMemo(() => ({
      getAll: getAllAnimations,
      getById: getAnimationById,
      getByUuid: getAnimationByUuid,
      save: saveAnimation,
      update: async (uuid: string, updates: Partial<AnimationRecord>) => {
        const svc = animationService;
        if (!svc) return { success: false, error: { type: 'UNKNOWN', message: 'Animation service not initialized' } };
        await svc.initialize();
        return await svc.updateAnimation(uuid, updates);
      },
      delete: deleteAnimation,
      search: searchAnimations,
      filter: filterAnimations,
      count: getAnimationCount,
      getUniqueCategories: getUniqueAnimationCategories,
      getUniqueTags: getUniqueAnimationTags,
      getRecent: getRecentAnimations,
      exists: animationExists,
      clearAll: clearAllAnimations,
      autoSave: async (animation: Omit<AnimationRecord, 'id' | 'uuid' | 'createdAt' | 'updatedAt'>, thumbnail?: string) => {
        const svc = animationService;
        if (!svc) return { success: false, error: { type: 'UNKNOWN', message: 'Animation service not initialized' } };
        await svc.initialize();
        return await svc.saveAnimation(animation, thumbnail);
      },
      autoUpdate: async (uuid: string, updates: Partial<AnimationRecord>) => {
        const svc = animationService;
        if (!svc) return { success: false, error: { type: 'UNKNOWN', message: 'Animation service not initialized' } };
        await svc.initialize();
        return await svc.updateAnimation(uuid, updates);
      },
    }), [animationService]),
    models: useMemo(() => ({
      getAll: getAllModels,
      getById: getModelById,
      getByUuid: getModelByUuid,
      save: saveModel,
      update: async (uuid: string, updates: Partial<ModelRecord>) => {
        const svc = modelService;
        if (!svc) return { success: false, error: { type: 'UNKNOWN', message: 'Model service not initialized' } };
        await svc.initialize();
        return await svc.updateModel(uuid, updates);
      },
      delete: deleteModel,
      search: searchModels,
      filter: filterModels,
      count: getModelCount,
      getUniqueCategories: getUniqueModelCategories,
      getUniqueTags: getUniqueModelTags,
      getRecent: getRecentModels,
      exists: modelExists,
      clearAll: clearAllModels,
      autoSave: async (model: Omit<ModelRecord, 'id' | 'uuid' | 'createdAt' | 'updatedAt'>, thumbnail?: string) => {
        const svc = modelService;
        if (!svc) return { success: false, error: { type: 'UNKNOWN', message: 'Model service not initialized' } };
        await svc.initialize();
        return await svc.saveModel(model, thumbnail);
      },
      autoUpdate: async (uuid: string, updates: Partial<ModelRecord>) => {
        const svc = modelService;
        if (!svc) return { success: false, error: { type: 'UNKNOWN', message: 'Model service not initialized' } };
        await svc.initialize();
        return await svc.updateModel(uuid, updates);
      },
    }), [modelService]),
    statistics: useMemo(() => ({
      get: getDatabaseStatistics,
    }), []),
    clearAll: clearAllData,
  };
}
