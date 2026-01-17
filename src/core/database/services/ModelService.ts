/**
 * Model Service
 * High-level operations for models
 */

import { getModelRepository } from '../repositories/ModelRepository';
import { getDatabaseService } from '../DatabaseService';
import { getThumbnailService } from './ThumbnailService';
import {
  ModelRecord,
  DatabaseOperationResult,
  DatabaseQueryOptions,
  DatabaseQueryResult,
} from '../../../types/database.types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Model Service
 * Provides high-level model operations
 */
export class ModelService {
  private repository = getModelRepository();
  private dbService = getDatabaseService();
  private thumbnailService = getThumbnailService();

  /**
   * Initialize service
   */
  async initialize(): Promise<void> {
    await this.dbService.initialize();
  }

  /**
   * Save model with metadata
   */
  async saveModel(
    model: Omit<ModelRecord, 'id' | 'uuid' | 'createdAt' | 'updatedAt'>,
    thumbnail?: string
  ): Promise<DatabaseOperationResult<ModelRecord>> {
    await this.initialize();

    try {
      // Save model
      const result = await this.repository.create(model);

      if (!result.success || !result.data) {
        return result;
      }

      // Save thumbnail if provided
      if (thumbnail) {
        await this.thumbnailService.saveThumbnail({
          uuid: uuidv4(),
          name: `${result.data.name}_thumbnail`,
          type: 'model',
          targetUuid: result.data.uuid,
          data: thumbnail,
          format: 'png',
          width: 256,
          height: 256,
          size: thumbnail.length,
          createdAt: new Date(),
        });
      }

      return result;
    } catch (error) {
      console.error('Failed to save model:', error);
      return {
        success: false,
        error: {
          type: 'UNKNOWN',
          message: 'Failed to save model',
          details: error,
        },
      };
    }
  }

  /**
   * Load model from database
   */
  async loadModel(uuid: string): Promise<DatabaseOperationResult<ModelRecord>> {
    await this.initialize();

    return await this.repository.getByUuid(uuid);
  }

  /**
   * Load model by ID
   */
  async loadModelById(id: number): Promise<DatabaseOperationResult<ModelRecord>> {
    await this.initialize();

    return await this.repository.getById(id);
  }

  /**
   * Delete model
   */
  async deleteModel(uuid: string): Promise<DatabaseOperationResult<void>> {
    await this.initialize();

    try {
      // Delete thumbnail
      await this.thumbnailService.deleteThumbnailByTarget(uuid);

      // Delete model
      return await this.repository.deleteByUuid(uuid);
    } catch (error) {
      console.error('Failed to delete model:', error);
      return {
        success: false,
        error: {
          type: 'UNKNOWN',
          message: 'Failed to delete model',
          details: error,
        },
      };
    }
  }

  /**
   * Update model
   */
  async updateModel(
    uuid: string,
    updates: Partial<ModelRecord>
  ): Promise<DatabaseOperationResult<ModelRecord>> {
    await this.initialize();

    return await this.repository.updateByUuid(uuid, updates);
  }

  /**
   * Search models
   */
  async searchModels(query: string): Promise<DatabaseOperationResult<ModelRecord[]>> {
    await this.initialize();

    const result = await this.repository.query({ search: query });

    return {
      success: true,
      data: result.data,
    };
  }

  /**
   * Filter models
   */
  async filterModels(options: DatabaseQueryOptions): Promise<DatabaseQueryResult<ModelRecord>> {
    await this.initialize();

    return await this.repository.query(options);
  }

  /**
   * Get all models
   */
  async getAllModels(): Promise<DatabaseOperationResult<ModelRecord[]>> {
    await this.initialize();

    return await this.repository.getAll();
  }

  /**
   * List all models
   */
  async listModels(): Promise<DatabaseOperationResult<ModelRecord[]>> {
    return await this.getAllModels();
  }

  /**
   * Get model count
   */
  async getModelCount(): Promise<number> {
    await this.initialize();

    return await this.repository.count();
  }

  /**
   * Get models by category
   */
  async getModelsByCategory(category: string): Promise<DatabaseOperationResult<ModelRecord[]>> {
    await this.initialize();

    const result = await this.repository.query({ category });

    return {
      success: true,
      data: result.data,
    };
  }

  /**
   * Get models by format
   */
  async getModelsByFormat(format: string): Promise<DatabaseOperationResult<ModelRecord[]>> {
    await this.initialize();

    const result = await this.repository.query({ format });

    return {
      success: true,
      data: result.data,
    };
  }

  /**
   * Get models by tags
   */
  async getModelsByTags(tags: string[]): Promise<DatabaseOperationResult<ModelRecord[]>> {
    await this.initialize();

    const result = await this.repository.query({ tags });

    return {
      success: true,
      data: result.data,
    };
  }

  /**
   * Get recent models
   */
  async getRecentModels(limit = 10): Promise<DatabaseOperationResult<ModelRecord[]>> {
    await this.initialize();

    const result = await this.repository.query({
      orderBy: 'createdAt',
      orderDirection: 'desc',
      limit,
    });

    return {
      success: true,
      data: result.data,
    };
  }

  /**
   * Bulk save models
   */
  async bulkSaveModels(
    models: Omit<ModelRecord, 'id' | 'uuid' | 'createdAt' | 'updatedAt'>[]
  ): Promise<DatabaseOperationResult<ModelRecord[]>> {
    await this.initialize();

    return await this.repository.bulkCreate(models);
  }

  /**
   * Bulk delete models
   */
  async bulkDeleteModels(uuids: string[]): Promise<DatabaseOperationResult<void>> {
    await this.initialize();

    try {
      // Get IDs from UUIDs
      const ids: number[] = [];
      for (const uuid of uuids) {
        const result = await this.repository.getByUuid(uuid);
        if (result.success && result.data?.id) {
          ids.push(result.data.id);
        }
      }

      // Delete thumbnails
      for (const uuid of uuids) {
        await this.thumbnailService.deleteThumbnailByTarget(uuid);
      }

      // Delete models
      return await this.repository.bulkDelete(ids);
    } catch (error) {
      console.error('Failed to bulk delete models:', error);
      return {
        success: false,
        error: {
          type: 'UNKNOWN',
          message: 'Failed to bulk delete models',
          details: error,
        },
      };
    }
  }

  /**
   * Clear all models
   */
  async clearAllModels(): Promise<DatabaseOperationResult<void>> {
    await this.initialize();

    try {
      // Delete all thumbnails
      await this.thumbnailService.clearThumbnailsByType('model');

      // Clear models
      return await this.repository.clear();
    } catch (error) {
      console.error('Failed to clear all models:', error);
      return {
        success: false,
        error: {
          type: 'UNKNOWN',
          message: 'Failed to clear all models',
          details: error,
        },
      };
    }
  }

  /**
   * Check if model exists
   */
  async modelExists(name: string): Promise<boolean> {
    await this.initialize();

    const result = await this.repository.getByName(name);
    return !!(result.success && result.data && result.data.length > 0);
  }

  /**
   * Get unique categories
   */
  async getUniqueCategories(): Promise<string[]> {
    await this.initialize();

    const result = await this.repository.getAll();
    if (!result.success || !result.data) {
      return [];
    }

    const categories = new Set(result.data.map((model) => model.category).filter((cat): cat is string => cat !== undefined));
    return Array.from(categories) as string[];
  }

  /**
   * Get unique tags
   */
  async getUniqueTags(): Promise<string[]> {
    await this.initialize();

    const result = await this.repository.getAll();
    if (!result.success || !result.data) {
      return [];
    }

    const tags = new Set(result.data.flatMap((model) => model.tags));
    return Array.from(tags);
  }

  /**
   * Get models by version
   */
  async getModelsByVersion(version: '0.0' | '1.0'): Promise<DatabaseOperationResult<ModelRecord[]>> {
    await this.initialize();

    const result = await this.repository.getAll();
    if (!result.success || !result.data) {
      return {
        success: false,
        error: {
          type: 'UNKNOWN',
          message: 'Failed to get models',
        },
      };
    }

    const filtered = result.data.filter((model) => model.version === version);

    return {
      success: true,
      data: filtered,
    };
  }
}

/**
 * Model service singleton
 */
let modelServiceInstance: ModelService | null = null;

/**
 * Get model service instance
 */
export function getModelService(): ModelService {
  if (!modelServiceInstance) {
    modelServiceInstance = new ModelService();
  }
  return modelServiceInstance;
}
