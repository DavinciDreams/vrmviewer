/**
 * Model Repository
 * Handles CRUD operations for models in database
 */

import { getDatabase } from '../schemas/databaseSchema';
import {
  ModelRecord,
  DatabaseQueryOptions,
  DatabaseQueryResult,
  DatabaseOperationResult,
  BulkOperationOptions,
  BulkOperationProgress,
  DatabaseError,
} from '../../../types/database.types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Model Repository
 * Provides database operations for models
 */
export class ModelRepository {
  private db = getDatabase();

  /**
   * Create a new model record
   */
  async create(model: Omit<ModelRecord, 'id' | 'uuid' | 'createdAt' | 'updatedAt'>): Promise<DatabaseOperationResult<ModelRecord>> {
    try {
      const now = new Date();
      const newModel: ModelRecord = {
        ...model,
        uuid: uuidv4(),
        createdAt: now,
        updatedAt: now,
      };

      const id = await this.db.models.add(newModel);
      const created = await this.db.models.get(id);

      return {
        success: true,
        data: created,
      };
    } catch (error) {
      console.error('Failed to create model:', error);
      return {
        success: false,
        error: {
          type: 'UNKNOWN',
          message: 'Failed to create model',
          details: error,
        },
      };
    }
  }

  /**
   * Get model by ID
   */
  async getById(id: number): Promise<DatabaseOperationResult<ModelRecord>> {
    try {
      const model = await this.db.models.get(id);

      if (!model) {
        return {
          success: false,
          error: {
            type: 'NOT_FOUND',
            message: `Model with ID ${id} not found`,
            details: error,
          },
        } as DatabaseOperationError;
      }

      return {
        success: true,
        data: model,
      };
    } catch (error) {
      console.error('Failed to get model by ID:', error);
      return {
        success: false,
        error: {
          type: 'UNKNOWN',
          message: 'Failed to get model',
          details: error,
        },
      } as DatabaseOperationError;
    }
  }

  /**
   * Get model by UUID
   */
  async getByUuid(uuid: string): Promise<DatabaseOperationResult<ModelRecord>> {
    try {
      const model = await this.db.models.where('uuid').equals(uuid).first();

      if (!model) {
        return {
          success: false,
          error: {
            type: 'NOT_FOUND',
            message: `Model with UUID ${uuid} not found`,
          },
        };
      }

      return {
        success: true,
        data: model,
      };
    } catch (error) {
      console.error('Failed to get model by UUID:', error);
      return {
        success: false,
        error: {
          type: 'UNKNOWN',
          message: 'Failed to get model',
          details: error,
        },
      };
    }
  }

  /**
   * Get model by name
   */
  async getByName(name: string): Promise<DatabaseOperationResult<ModelRecord[]>> {
    try {
      const models = await this.db.models.where('name').equals(name).toArray();

      return {
        success: true,
        data: models,
      };
    } catch (error) {
      console.error('Failed to get models by name:', error);
      return {
        success: false,
        error: {
          type: 'UNKNOWN',
          message: 'Failed to get models by name',
          details: error,
        },
      };
    }
  }

  /**
   * Query models with options
   */
  async query(options: DatabaseQueryOptions = {}): Promise<DatabaseQueryResult<ModelRecord>> {
    try {
      let collection = this.db.models.toCollection();

      // Apply search filter
      if (options.search) {
        const searchTerm = options.search.toLowerCase();
        collection = collection.filter((model) => {
          return (
            model.name.toLowerCase().includes(searchTerm) ||
            model.displayName.toLowerCase().includes(searchTerm) ||
            (model.description && model.description.toLowerCase().includes(searchTerm)) ||
            model.tags.some((tag) => tag.toLowerCase().includes(searchTerm))
          );
        });
      }

      // Apply category filter
      if (options.category) {
        collection = collection.filter((model) => model.category === options.category);
      }

      // Apply format filter
      if (options.format) {
        collection = collection.filter((model) => model.format === options.format);
      }

      // Apply date range filter
      if (options.startDate || options.endDate) {
        collection = collection.filter((model) => {
          if (options.startDate && model.createdAt < options.startDate) {
            return false;
          }
          if (options.endDate && model.createdAt > options.endDate) {
            return false;
          }
          return true;
        });
      }

      // Apply tag filter
      if (options.tags && options.tags.length > 0) {
        collection = collection.filter((model) =>
          options.tags!.some((tag) => model.tags.includes(tag))
        );
      }

      // Get all filtered records
      const results = await collection.toArray();

      // Get total count before pagination
      const total = results.length;

      // Apply sorting
      const orderBy = options.orderBy || 'createdAt';
      const orderDirection = options.orderDirection || 'desc';

      results.sort((a, b) => {
        const aVal = a[orderBy];
        const bVal = b[orderBy];

        if (aVal === undefined || bVal === undefined) return 0;

        if (aVal < bVal) return orderDirection === 'asc' ? -1 : 1;
        if (aVal > bVal) return orderDirection === 'asc' ? 1 : -1;
        return 0;
      });

      // Apply pagination
      const offset = options.offset || 0;
      const limit = options.limit || results.length;

      const paginatedResults = results.slice(offset, offset + limit);

      return {
        data: paginatedResults,
        total,
        hasMore: offset + limit < total,
      };
    } catch (error) {
      console.error('Failed to query models:', error);
      return {
        data: [],
        total: 0,
        hasMore: false,
      };
    }
  }

  /**
   * Get all models
   */
  async getAll(): Promise<DatabaseOperationResult<ModelRecord[]>> {
    try {
      const models = await this.db.models.toArray();

      return {
        success: true,
        data: models,
      };
    } catch (error) {
      console.error('Failed to get all models:', error);
      return {
        success: false,
        error: {
          type: 'UNKNOWN',
          message: 'Failed to get all models',
          details: error,
        },
      };
    }
  }

  /**
   * Update model
   */
  async update(id: number, updates: Partial<ModelRecord>): Promise<DatabaseOperationResult<ModelRecord>> {
    try {
      const existing = await this.db.models.get(id);

      if (!existing) {
        return {
          success: false,
          error: {
            type: 'NOT_FOUND',
            message: `Model with ID ${id} not found`,
          },
        };
      }

      const updated: ModelRecord = {
        ...existing,
        ...updates,
        updatedAt: new Date(),
      };

      await this.db.models.put(updated);
      const result = await this.db.models.get(id);

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      console.error('Failed to update model:', error);
      return {
        success: false,
        error: {
          type: 'UNKNOWN',
          message: 'Failed to update model',
          details: error,
        },
      };
    }
  }

  /**
   * Update model by UUID
   */
  async updateByUuid(uuid: string, updates: Partial<ModelRecord>): Promise<DatabaseOperationResult<ModelRecord>> {
    try {
      const existing = await this.db.models.where('uuid').equals(uuid).first();

      if (!existing) {
        return {
          success: false,
          error: {
            type: 'NOT_FOUND',
            message: `Model with UUID ${uuid} not found`,
          },
        };
      }

      const updated: ModelRecord = {
        ...existing,
        ...updates,
        updatedAt: new Date(),
      };

      await this.db.models.put(updated);
      const result = await this.db.models.get(existing.id!);

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      console.error('Failed to update model by UUID:', error);
      return {
        success: false,
        error: {
          type: 'UNKNOWN',
          message: 'Failed to update model',
          details: error,
        },
      };
    }
  }

  /**
   * Delete model
   */
  async delete(id: number): Promise<DatabaseOperationResult<void>> {
    try {
      await this.db.models.delete(id);

      return {
        success: true,
      };
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
   * Delete model by UUID
   */
  async deleteByUuid(uuid: string): Promise<DatabaseOperationResult<void>> {
    try {
      const model = await this.db.models.where('uuid').equals(uuid).first();

      if (!model) {
        return {
          success: false,
          error: {
            type: 'NOT_FOUND',
            message: `Model with UUID ${uuid} not found`,
          },
        };
      }

      await this.db.models.delete(model.id!);

      return {
        success: true,
      };
    } catch (error) {
      console.error('Failed to delete model by UUID:', error);
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
   * Bulk create models
   */
  async bulkCreate(
    models: Omit<ModelRecord, 'id' | 'uuid' | 'createdAt' | 'updatedAt'>[],
    options?: BulkOperationOptions
  ): Promise<DatabaseOperationResult<ModelRecord[]>> {
    const batchSize = options?.batchSize || 50;
    const continueOnError = options?.continueOnError ?? true;
    const errors: DatabaseError[] = [];

    try {
      const now = new Date();
      const newModels: ModelRecord[] = models.map((model) => ({
        ...model,
        uuid: uuidv4(),
        createdAt: now,
        updatedAt: now,
      }));

      const results: ModelRecord[] = [];
      const total = newModels.length;

      for (let i = 0; i < total; i += batchSize) {
        const batch = newModels.slice(i, i + batchSize);

        try {
          const ids = await this.db.models.bulkAdd(batch, { allKeys: true });
          const created = await this.db.models.bulkGet(ids as number[]);
          results.push(...(created.filter((r): r is ModelRecord => r !== undefined)));
        } catch (error) {
          if (continueOnError) {
            errors.push({
              type: 'UNKNOWN',
              message: String(error),
              details: error,
            });
            // Try adding one by one
            for (const model of batch) {
              try {
                const id = await this.db.models.add(model);
                const created = await this.db.models.get(id);
                if (created) {
                  results.push(created);
                }
              } catch (err) {
                errors.push({
                  type: 'UNKNOWN',
                  message: String(err),
                  details: err,
                });
              }
            }
          } else {
            throw error;
          }
        }

        // Report progress
        if (options?.progressCallback) {
          const progress: BulkOperationProgress = {
            completed: Math.min(i + batchSize, total),
            total,
            percentage: Math.min(((i + batchSize) / total) * 100, 100),
            errors: errors as DatabaseError[],
          };
          options.progressCallback(progress);
        }
      }

      return {
        success: true,
        data: results,
      };
    } catch (error) {
      console.error('Failed to bulk create models:', error);
      return {
        success: false,
        error: {
          type: 'UNKNOWN',
          message: 'Failed to bulk create models',
          details: error,
        },
      };
    }
  }

  /**
   * Bulk delete models
   */
  async bulkDelete(
    ids: number[],
    options?: BulkOperationOptions
  ): Promise<DatabaseOperationResult<void>> {
    const batchSize = options?.batchSize || 50;
    const continueOnError = options?.continueOnError ?? true;
    const errors: DatabaseError[] = [];

    try {
      const total = ids.length;

      for (let i = 0; i < total; i += batchSize) {
        const batch = ids.slice(i, i + batchSize);

        try {
          await this.db.models.bulkDelete(batch);
        } catch (error) {
          if (continueOnError) {
            errors.push({
              type: 'UNKNOWN',
              message: String(error),
              details: error,
            });
            // Try deleting one by one
            for (const id of batch) {
              try {
                await this.db.models.delete(id);
              } catch (err) {
                errors.push({
                  type: 'UNKNOWN',
                  message: String(err),
                  details: err,
                });
              }
            }
          } else {
            throw error;
          }
        }

        // Report progress
        if (options?.progressCallback) {
          const progress: BulkOperationProgress = {
            completed: Math.min(i + batchSize, total),
            total,
            percentage: Math.min(((i + batchSize) / total) * 100, 100),
            errors: errors as DatabaseError[],
          };
          options.progressCallback(progress);
        }
      }

      return {
        success: true,
      };
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
   * Count models
   */
  async count(): Promise<number> {
    try {
      return await this.db.models.count();
    } catch (error) {
      console.error('Failed to count models:', error);
      return 0;
    }
  }

  /**
   * Clear all models
   */
  async clear(): Promise<DatabaseOperationResult<void>> {
    try {
      await this.db.models.clear();

      return {
        success: true,
      };
    } catch (error) {
      console.error('Failed to clear models:', error);
      return {
        success: false,
        error: {
          type: 'UNKNOWN',
          message: 'Failed to clear models',
          details: error,
        },
      };
    }
  }
}

/**
 * Model repository singleton
 */
let modelRepositoryInstance: ModelRepository | null = null;

/**
 * Get model repository instance
 */
export function getModelRepository(): ModelRepository {
  if (!modelRepositoryInstance) {
    modelRepositoryInstance = new ModelRepository();
  }
  return modelRepositoryInstance;
}
