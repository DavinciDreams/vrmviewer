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
 * ModelRecordSummary
 * A ModelRecord projection with the binary blob stripped out.
 * Safe to accumulate in memory for list/query results.
 * `data` is typed as `undefined` to signal the absence of the blob at the type level.
 *
 * NOTE: Repository methods that return `DatabaseOperationResult<ModelRecord>` or
 * `DatabaseQueryResult<ModelRecord>` for ModelService compatibility use a type
 * assertion (`as`) when returning summaries. Callers that need the actual blob
 * must use `getById(id, true)` or `getByUuid(uuid, true)`.
 */
export type ModelRecordSummary = Omit<ModelRecord, 'data'> & { data?: undefined };

/**
 * Commercial-usage values that count as "has commercial use"
 */
const COMMERCIAL_USE_ALLOWED = new Set(['Allow', 'PersonalProfit', 'Corporation']);

/**
 * Tokenize a search string into lowercase terms suitable for matching
 * against the `searchTokens` multiEntry index.
 */
function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.replace(/[^\w]/g, ''))
    .filter((t) => t.length > 0);
}

/**
 * Model Repository
 * Provides database operations for models
 */
export class ModelRepository {
  private db = getDatabase();

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Return a shallow copy of `record` with `data` set to undefined.
   * Used for ALL list-style returns so ArrayBuffers never accumulate in memory.
   */
  private stripBlob(record: ModelRecord): ModelRecordSummary {
    const { data: _data, ...rest } = record;
    return rest as ModelRecordSummary;
  }

  /**
   * Apply v3 in-memory filters (polyBucket, isHumanoid, license, hasCommercialUse)
   * to an already-narrowed candidate set. These are applied after an index lookup
   * so the candidate set is small.
   */
  private applyFacetFilters(
    records: ModelRecordSummary[],
    options: DatabaseQueryOptions
  ): ModelRecordSummary[] {
    return records.filter((r) => {
      if (options.polyBucket !== undefined && r.polyBucket !== options.polyBucket) return false;
      if (options.isHumanoid !== undefined && r.isHumanoid !== options.isHumanoid) return false;
      if (options.license !== undefined && r.license !== options.license) return false;
      if (options.hasCommercialUse === true) {
        const usage = r.normalizedLicense?.commercialUsage;
        if (!usage || !COMMERCIAL_USE_ALLOWED.has(usage)) return false;
      }
      return true;
    });
  }

  // ---------------------------------------------------------------------------
  // Single-record lookups
  // ---------------------------------------------------------------------------

  /**
   * Get model by ID.
   * @param id - Primary key
   * @param includeBlob - When true (default) the returned record carries the full
   *   ArrayBuffer. Pass false to get a blob-free ModelRecordSummary.
   */
  async getById(id: number, includeBlob?: true): Promise<DatabaseOperationResult<ModelRecord>>;
  async getById(id: number, includeBlob: false): Promise<DatabaseOperationResult<ModelRecordSummary>>;
  async getById(
    id: number,
    includeBlob = true
  ): Promise<DatabaseOperationResult<ModelRecord | ModelRecordSummary>> {
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
        data: includeBlob ? model : this.stripBlob(model),
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
   * Get model by UUID.
   * @param uuid - Model UUID
   * @param includeBlob - When true (default) the returned record carries the full
   *   ArrayBuffer. Pass false to get a blob-free ModelRecordSummary.
   */
  async getByUuid(uuid: string, includeBlob?: true): Promise<DatabaseOperationResult<ModelRecord>>;
  async getByUuid(uuid: string, includeBlob: false): Promise<DatabaseOperationResult<ModelRecordSummary>>;
  async getByUuid(
    uuid: string,
    includeBlob = true
  ): Promise<DatabaseOperationResult<ModelRecord | ModelRecordSummary>> {
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
        data: includeBlob ? model : this.stripBlob(model),
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

  // ---------------------------------------------------------------------------
  // Create
  // ---------------------------------------------------------------------------

  /**
   * Create a new model record
   */
  async create(
    model: Omit<ModelRecord, 'id' | 'uuid' | 'createdAt' | 'updatedAt'>
  ): Promise<DatabaseOperationResult<ModelRecord>> {
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

  // ---------------------------------------------------------------------------
  // Query
  // ---------------------------------------------------------------------------

  /**
   * Query models with options.
   *
   * Index strategy (in priority order):
   *   1. search present   → searchTokens multiEntry index + optional facet filters
   *   2. format + date    → [format+createdAt] compound index
   *   3. category+format  → [category+format] compound index
   *   4. format alone     → format index
   *   5. category alone   → full scan with filter (category index not compound-searchable)
   *   6. fallback         → full scan with filter
   *
   * The binary blob is NEVER included in results. Return type is declared as
   * `ModelRecord` for ModelService compatibility — at runtime `data` is undefined
   * on every result record. Use `getByUuid(uuid, true)` to load the actual blob.
   */
  async query(
    options: DatabaseQueryOptions = {}
  ): Promise<DatabaseQueryResult<ModelRecord>> {
    try {
      let summaries: ModelRecordSummary[] = [];

      if (options.search) {
        // ---- Index path 1: searchTokens multiEntry index ----
        const tokens = tokenize(options.search);

        if (tokens.length === 0) {
          // Empty after tokenization — fall back to full scan
          summaries = await this._fullScanSummaries(options);
        } else if (tokens.length === 1) {
          // Single token: use index, get primary keys, bulkGet
          const keys = (await this.db.models
            .where('searchTokens')
            .equals(tokens[0])
            .primaryKeys()) as number[];

          const raw = await this.db.models.bulkGet(keys);
          summaries = (raw.filter(Boolean) as ModelRecord[]).map((r) => this.stripBlob(r));
        } else {
          // Multi-token: anyOf on index, then rank by overlap in-memory
          const keySet = new Map<number, number>(); // id → token hit count

          for (const token of tokens) {
            const keys = (await this.db.models
              .where('searchTokens')
              .equals(token)
              .primaryKeys()) as number[];
            for (const k of keys) {
              keySet.set(k, (keySet.get(k) ?? 0) + 1);
            }
          }

          // Sort by descending token overlap
          const sortedIds = [...keySet.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([id]) => id);

          const raw = await this.db.models.bulkGet(sortedIds);
          summaries = (raw.filter(Boolean) as ModelRecord[]).map((r) => this.stripBlob(r));
        }

        // Fallback substring scan ONLY when the indexed path returned nothing.
        // Trusting the index when it produced hits avoids a full table scan per
        // keystroke for the common case. The fallback exists for pre-backfill
        // records that don't yet have searchTokens populated.
        if (summaries.length === 0 && tokens.length > 0) {
          const searchLower = options.search.toLowerCase();
          const fallbackSummaries: ModelRecordSummary[] = [];

          await this.db.models.each((model) => {
            if (
              model.name.toLowerCase().includes(searchLower) ||
              model.displayName.toLowerCase().includes(searchLower) ||
              (model.description && model.description.toLowerCase().includes(searchLower)) ||
              model.tags.some((tag) => tag.toLowerCase().includes(searchLower))
            ) {
              fallbackSummaries.push(this.stripBlob(model));
            }
          });

          summaries = fallbackSummaries;
        }
      } else if (options.format && (options.startDate || options.endDate)) {
        // ---- Index path 2: [format+createdAt] compound index ----
        // Dexie compound indexes require an exact key for the first component.
        // Use where('[format+createdAt]').between for range queries.
        const lower = [options.format, options.startDate ?? new Date(0)];
        const upper = [options.format, options.endDate ?? new Date(8640000000000000)];

        const raw = await this.db.models
          .where('[format+createdAt]')
          .between(lower, upper, true, true)
          .toArray();
        summaries = raw.map((r) => this.stripBlob(r));
      } else if (options.category && options.format) {
        // ---- Index path 3: [category+format] compound index ----
        const raw = await this.db.models
          .where('[category+format]')
          .equals([options.category, options.format])
          .toArray();
        summaries = raw.map((r) => this.stripBlob(r));
      } else if (options.format) {
        // ---- Index path 4: format single index ----
        const raw = await this.db.models
          .where('format')
          .equals(options.format)
          .toArray();
        summaries = raw.map((r) => this.stripBlob(r));
      } else {
        // ---- Fallback: full scan (strips blobs via .each) ----
        summaries = await this._fullScanSummaries(options);
      }

      // Apply category filter when not already handled by compound index
      if (options.category && !options.format) {
        summaries = summaries.filter((r) => r.category === options.category);
      }

      // Apply tag filter
      if (options.tags && options.tags.length > 0) {
        const tagSet = new Set(options.tags);
        summaries = summaries.filter((r) =>
          r.tags?.some((t) => tagSet.has(t))
        );
      }

      // Apply v3 facet filters (polyBucket, isHumanoid, license, hasCommercialUse)
      summaries = this.applyFacetFilters(summaries, options);

      // Total before pagination
      const total = summaries.length;

      // Sort
      const orderBy = options.orderBy ?? 'createdAt';
      const orderDirection = options.orderDirection ?? 'desc';

      summaries.sort((a, b) => {
        const aVal = a[orderBy as keyof ModelRecordSummary];
        const bVal = b[orderBy as keyof ModelRecordSummary];

        if (aVal === undefined || bVal === undefined) return 0;
        if (aVal < bVal) return orderDirection === 'asc' ? -1 : 1;
        if (aVal > bVal) return orderDirection === 'asc' ? 1 : -1;
        return 0;
      });

      // Paginate
      const offset = options.offset ?? 0;
      const limit = options.limit ?? summaries.length;
      const paginated = summaries.slice(offset, offset + limit);

      return {
        // Cast: summaries are ModelRecord-shaped minus data; safe for display callers
        data: paginated as unknown as ModelRecord[],
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
   * Full table scan that streams records via `.each()` so blobs never all
   * accumulate in memory simultaneously. Returns summaries only.
   */
  private async _fullScanSummaries(
    options: DatabaseQueryOptions
  ): Promise<ModelRecordSummary[]> {
    const results: ModelRecordSummary[] = [];

    await this.db.models.each((model) => {
      // category / format filters applied during scan
      if (options.category && model.category !== options.category) return;
      if (options.format && model.format !== options.format) return;
      if (options.startDate && model.createdAt < options.startDate) return;
      if (options.endDate && model.createdAt > options.endDate) return;

      results.push(this.stripBlob(model));
    });

    return results;
  }

  // ---------------------------------------------------------------------------
  // Get all (streaming, blob-free)
  // ---------------------------------------------------------------------------

  /**
   * Get all models as summaries (no ArrayBuffer blobs).
   * Streams through the table with .each() to avoid loading all blobs at once.
   * Return type is declared as `ModelRecord[]` for ModelService compatibility —
   * at runtime `data` is undefined on every record. Use getByUuid with includeBlob=true
   * to retrieve the actual ArrayBuffer for a specific model.
   */
  async getAll(): Promise<DatabaseOperationResult<ModelRecord[]>> {
    try {
      const summaries: ModelRecordSummary[] = [];

      await this.db.models.each((model) => {
        summaries.push(this.stripBlob(model));
      });

      return {
        success: true,
        // Cast: summaries are ModelRecord-shaped minus data; safe for display callers
        data: summaries as unknown as ModelRecord[],
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

  // ---------------------------------------------------------------------------
  // v3 new methods
  // ---------------------------------------------------------------------------

  /**
   * Find a model by its SHA-256 file hash.
   * Used for dedup checks before storing a new upload.
   */
  async findBySha256(
    sha256: string
  ): Promise<DatabaseOperationResult<ModelRecordSummary>> {
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

      return {
        success: true,
        data: this.stripBlob(model),
      };
    } catch (error) {
      console.error('Failed to find model by sha256:', error);
      return {
        success: false,
        error: {
          type: 'UNKNOWN',
          message: 'Failed to find model by sha256',
          details: error,
        },
      };
    }
  }

  /**
   * Return the distinct values present in a single-value index column.
   * Uses Dexie's `.uniqueKeys()` — O(distinct) not O(rows).
   *
   * @param field - One of the indexed string columns
   */
  async getDistinctValues(
    field: 'category' | 'format' | 'license' | 'author'
  ): Promise<string[]> {
    try {
      const keys = await this.db.models.orderBy(field).uniqueKeys();
      // uniqueKeys() returns IndexableType[]; filter to strings only
      return (keys as unknown[]).filter(
        (k): k is string => typeof k === 'string' && k.length > 0
      );
    } catch (error) {
      console.error(`Failed to get distinct values for field "${field}":`, error);
      return [];
    }
  }

  // ---------------------------------------------------------------------------
  // Update
  // ---------------------------------------------------------------------------

  /**
   * Update model
   */
  async update(
    id: number,
    updates: Partial<ModelRecord>
  ): Promise<DatabaseOperationResult<ModelRecord>> {
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
  async updateByUuid(
    uuid: string,
    updates: Partial<ModelRecord>
  ): Promise<DatabaseOperationResult<ModelRecord>> {
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

  // ---------------------------------------------------------------------------
  // Delete
  // ---------------------------------------------------------------------------

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

  // ---------------------------------------------------------------------------
  // Bulk operations
  // ---------------------------------------------------------------------------

  /**
   * Bulk create models
   */
  async bulkCreate(
    models: Omit<ModelRecord, 'id' | 'uuid' | 'createdAt' | 'updatedAt'>[],
    options?: BulkOperationOptions
  ): Promise<DatabaseOperationResult<ModelRecord[]>> {
    const batchSize = options?.batchSize ?? 50;
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
    const batchSize = options?.batchSize ?? 50;
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

  // ---------------------------------------------------------------------------
  // Utility
  // ---------------------------------------------------------------------------

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
