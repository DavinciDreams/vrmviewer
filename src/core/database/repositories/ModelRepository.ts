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
 * Summary view of a model — same shape as ModelRecord but with the raw
 * `data: ArrayBuffer` stripped. Useful for any code path that needs to
 * scan/inspect records without paying the cost of pulling the model blob
 * into memory (e.g. dedup lookups, library listings, batch metadata
 * inspection).
 */
export type ModelRecordSummary = Omit<ModelRecord, 'data'> & { data?: undefined };

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
          },
        };
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
      };
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

      // Extraction-pipeline facet filters (all optional; only kick in for
      // records that have the field populated — pre-pipeline records pass
      // through unfiltered when the facet is unset, which is the desired
      // behaviour since absence ≠ "not commercial-allowed").
      if (options.polyBucket) {
        collection = collection.filter((model) => model.polyBucket === options.polyBucket);
      }
      if (options.isHumanoid !== undefined) {
        collection = collection.filter((model) => model.isHumanoid === options.isHumanoid);
      }
      if (options.license) {
        collection = collection.filter((model) => model.license === options.license);
      }
      if (options.hasCommercialUse) {
        // Permitted iff normalizedLicense.commercialUsage is one of the
        // explicit allow values. Records without normalizedLicense are
        // excluded — we can't assert their stance.
        const ALLOWED = new Set(['Allow', 'PersonalProfit', 'Corporation']);
        collection = collection.filter((model) => {
          const usage = model.normalizedLicense?.commercialUsage;
          return !!usage && ALLOWED.has(usage);
        });
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
   * Get all models without their raw `data` ArrayBuffer.
   *
   * Library listings only need metadata + thumbnail; pulling every
   * record's binary into memory is wasteful and grows linearly with
   * library size. Internally streams via `.each()` and clones each
   * record sans `data`, so memory pressure is one row at a time
   * rather than the whole table.
   */
  async getAllSummaries(): Promise<DatabaseOperationResult<ModelRecordSummary[]>> {
    try {
      const summaries: ModelRecordSummary[] = [];
      await this.db.models.each((record) => {
        const { data: _omit, ...rest } = record;
        void _omit;
        summaries.push(rest as ModelRecordSummary);
      });
      return {
        success: true,
        data: summaries,
      };
    } catch (error) {
      console.error('Failed to get model summaries:', error);
      return {
        success: false,
        error: {
          type: 'UNKNOWN',
          message: 'Failed to get model summaries',
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

  /**
   * Find a model by its SHA-256 hash.
   *
   * Used by the dedup path in `ModelService.saveModel` — when the extraction
   * pipeline produces a hash that matches an existing record, the save is
   * skipped and the caller is told the model already exists. Returns a
   * blob-free `ModelRecordSummary` since the call sites only need metadata
   * to confirm a match.
   *
   * Requires the `sha256` index added in schema v4.
   */
  async findBySha256(sha256: string): Promise<DatabaseOperationResult<ModelRecordSummary>> {
    try {
      const model = await this.db.models.where('sha256').equals(sha256).first();

      if (!model) {
        return {
          success: false,
          error: {
            type: 'NOT_FOUND',
            message: `No model found with sha256 ${sha256}`,
          },
        };
      }

      // Strip the ArrayBuffer blob — callers don't need it for dedup.
      const summary: ModelRecordSummary = {
        ...model,
        data: undefined,
      };
      return { success: true, data: summary };
    } catch (error) {
      console.error(`Failed to find model by sha256 ${sha256}:`, error);
      return {
        success: false,
        error: {
          type: 'UNKNOWN',
          message: 'Failed to look up model by sha256',
          details: error,
        },
      };
    }
  }

  /**
   * Return the distinct values for one of the indexed scalar fields. Used
   * to populate faceted-filter dropdowns without scanning every record.
   *
   * Constrained to fields that are indexed on the `models` table in schema
   * v4 — Dexie throws if you try `orderBy` on a non-indexed field.
   */
  async getDistinctValues(
    field: 'category' | 'format' | 'license' | 'author',
  ): Promise<string[]> {
    try {
      const keys = await this.db.models.orderBy(field).uniqueKeys();
      // uniqueKeys() returns IndexableType[]; filter to non-empty strings.
      return (keys as unknown[]).filter(
        (k): k is string => typeof k === 'string' && k.length > 0,
      );
    } catch (error) {
      console.error(`Failed to get distinct values for field "${field}":`, error);
      return [];
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
