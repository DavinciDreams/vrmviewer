/**
 * Animation Repository
 * Handles CRUD operations for animations in database
 */

import { getDatabase } from '../schemas/databaseSchema';
import {
  AnimationRecord,
  DatabaseQueryOptions,
  DatabaseQueryResult,
  DatabaseOperationResult,
  BulkOperationOptions,
  BulkOperationProgress,
  DatabaseError,
} from '../../../types/database.types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Animation Repository
 * Provides database operations for animations
 */
export class AnimationRepository {
  private db = getDatabase();

  /**
   * Create a new animation record
   */
  async create(animation: Omit<AnimationRecord, 'id' | 'uuid' | 'createdAt' | 'updatedAt'>): Promise<DatabaseOperationResult<AnimationRecord>> {
    try {
      const now = new Date();
      const newAnimation: AnimationRecord = {
        ...animation,
        uuid: uuidv4(),
        createdAt: now,
        updatedAt: now,
      };

      const id = await this.db.animations.add(newAnimation);
      const created = await this.db.animations.get(id);

      return {
        success: true,
        data: created,
      };
    } catch (error) {
      console.error('Failed to create animation:', error);
      return {
        success: false,
        error: {
          type: 'UNKNOWN',
          message: 'Failed to create animation',
          details: error,
        },
      };
    }
  }

  /**
   * Get animation by ID
   */
  async getById(id: number): Promise<DatabaseOperationResult<AnimationRecord>> {
    try {
      const animation = await this.db.animations.get(id);

      if (!animation) {
        return {
          success: false,
          error: {
            type: 'NOT_FOUND',
            message: `Animation with ID ${id} not found`,
          },
        };
      }

      return {
        success: true,
        data: animation,
      };
    } catch (error) {
      console.error('Failed to get animation by ID:', error);
      return {
        success: false,
        error: {
          type: 'UNKNOWN',
          message: 'Failed to get animation',
          details: error,
        },
      };
    }
  }

  /**
   * Get animation by UUID
   */
  async getByUuid(uuid: string): Promise<DatabaseOperationResult<AnimationRecord>> {
    try {
      const animation = await this.db.animations.where('uuid').equals(uuid).first();

      if (!animation) {
        return {
          success: false,
          error: {
            type: 'NOT_FOUND',
            message: `Animation with UUID ${uuid} not found`,
          },
        };
      }

      return {
        success: true,
        data: animation,
      };
    } catch (error) {
      console.error('Failed to get animation by UUID:', error);
      return {
        success: false,
        error: {
          type: 'UNKNOWN',
          message: 'Failed to get animation',
          details: error,
        },
      };
    }
  }

  /**
   * Get animation by name
   */
  async getByName(name: string): Promise<DatabaseOperationResult<AnimationRecord[]>> {
    try {
      const animations = await this.db.animations.where('name').equals(name).toArray();

      return {
        success: true,
        data: animations,
      };
    } catch (error) {
      console.error('Failed to get animations by name:', error);
      return {
        success: false,
        error: {
          type: 'UNKNOWN',
          message: 'Failed to get animations by name',
          details: error,
        },
      };
    }
  }

  /**
   * Query animations with options
   */
  async query(options: DatabaseQueryOptions = {}): Promise<DatabaseQueryResult<AnimationRecord>> {
    try {
      let collection = this.db.animations.toCollection();

      // Apply search filter
      if (options.search) {
        const searchTerm = options.search.toLowerCase();
        collection = collection.filter((anim) => {
          return (
            anim.name.toLowerCase().includes(searchTerm) ||
            anim.displayName.toLowerCase().includes(searchTerm) ||
            (anim.description && anim.description.toLowerCase().includes(searchTerm)) ||
            anim.tags.some((tag) => tag.toLowerCase().includes(searchTerm))
          );
        });
      }

      // Apply category filter
      if (options.category) {
        collection = collection.filter((anim) => anim.category === options.category);
      }

      // Apply format filter
      if (options.format) {
        collection = collection.filter((anim) => anim.format === options.format);
      }

      // Apply date range filter
      if (options.startDate || options.endDate) {
        collection = collection.filter((anim) => {
          if (options.startDate && anim.createdAt < options.startDate) {
            return false;
          }
          if (options.endDate && anim.createdAt > options.endDate) {
            return false;
          }
          return true;
        });
      }

      // Apply tag filter
      if (options.tags && options.tags.length > 0) {
        collection = collection.filter((anim) =>
          options.tags!.some((tag) => anim.tags.includes(tag))
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
      console.error('Failed to query animations:', error);
      return {
        data: [],
        total: 0,
        hasMore: false,
      };
    }
  }

  /**
   * Get all animations
   */
  async getAll(): Promise<DatabaseOperationResult<AnimationRecord[]>> {
    try {
      const animations = await this.db.animations.toArray();

      return {
        success: true,
        data: animations,
      };
    } catch (error) {
      console.error('Failed to get all animations:', error);
      return {
        success: false,
        error: {
          type: 'UNKNOWN',
          message: 'Failed to get all animations',
          details: error,
        },
      };
    }
  }

  /**
   * Update animation
   */
  async update(id: number, updates: Partial<AnimationRecord>): Promise<DatabaseOperationResult<AnimationRecord>> {
    try {
      const existing = await this.db.animations.get(id);

      if (!existing) {
        return {
          success: false,
          error: {
            type: 'NOT_FOUND',
            message: `Animation with ID ${id} not found`,
          },
        };
      }

      const updated: AnimationRecord = {
        ...existing,
        ...updates,
        updatedAt: new Date(),
      };

      await this.db.animations.put(updated);
      const result = await this.db.animations.get(id);

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      console.error('Failed to update animation:', error);
      return {
        success: false,
        error: {
          type: 'UNKNOWN',
          message: 'Failed to update animation',
          details: error,
        },
      };
    }
  }

  /**
   * Update animation by UUID
   */
  async updateByUuid(uuid: string, updates: Partial<AnimationRecord>): Promise<DatabaseOperationResult<AnimationRecord>> {
    try {
      const existing = await this.db.animations.where('uuid').equals(uuid).first();

      if (!existing) {
        return {
          success: false,
          error: {
            type: 'NOT_FOUND',
            message: `Animation with UUID ${uuid} not found`,
          },
        };
      }

      const updated: AnimationRecord = {
        ...existing,
        ...updates,
        updatedAt: new Date(),
      };

      await this.db.animations.put(updated);
      const result = await this.db.animations.get(existing.id!);

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      console.error('Failed to update animation by UUID:', error);
      return {
        success: false,
        error: {
          type: 'UNKNOWN',
          message: 'Failed to update animation',
          details: error,
        },
      };
    }
  }

  /**
   * Delete animation
   */
  async delete(id: number): Promise<DatabaseOperationResult<void>> {
    try {
      await this.db.animations.delete(id);

      return {
        success: true,
      };
    } catch (error) {
      console.error('Failed to delete animation:', error);
      return {
        success: false,
        error: {
          type: 'UNKNOWN',
          message: 'Failed to delete animation',
          details: error,
        },
      };
    }
  }

  /**
   * Delete animation by UUID
   */
  async deleteByUuid(uuid: string): Promise<DatabaseOperationResult<void>> {
    try {
      const animation = await this.db.animations.where('uuid').equals(uuid).first();

      if (!animation) {
        return {
          success: false,
          error: {
            type: 'NOT_FOUND',
            message: `Animation with UUID ${uuid} not found`,
          },
        };
      }

      await this.db.animations.delete(animation.id!);

      return {
        success: true,
      };
    } catch (error) {
      console.error('Failed to delete animation by UUID:', error);
      return {
        success: false,
        error: {
          type: 'UNKNOWN',
          message: 'Failed to delete animation',
          details: error,
        },
      };
    }
  }

  /**
   * Bulk create animations
   */
  async bulkCreate(
    animations: Omit<AnimationRecord, 'id' | 'uuid' | 'createdAt' | 'updatedAt'>[],
    options?: BulkOperationOptions
  ): Promise<DatabaseOperationResult<AnimationRecord[]>> {
    const batchSize = options?.batchSize || 50;
    const continueOnError = options?.continueOnError ?? true;
    const errors: DatabaseError[] = [];

    try {
      const now = new Date();
      const newAnimations: AnimationRecord[] = animations.map((anim) => ({
        ...anim,
        uuid: uuidv4(),
        createdAt: now,
        updatedAt: now,
      }));

      const results: AnimationRecord[] = [];
      const total = newAnimations.length;

      for (let i = 0; i < total; i += batchSize) {
        const batch = newAnimations.slice(i, i + batchSize);

        try {
          const ids = await this.db.animations.bulkAdd(batch, { allKeys: true });
          const created = await this.db.animations.bulkGet(ids as number[]);
          results.push(...(created.filter((r): r is AnimationRecord => r !== undefined)));
        } catch (error) {
          if (continueOnError) {
            errors.push({
              type: 'UNKNOWN',
              message: String(error),
              details: error,
            });
            // Try adding one by one
            for (const anim of batch) {
              try {
                const id = await this.db.animations.add(anim);
                const created = await this.db.animations.get(id);
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
            errors,
          };
          options.progressCallback(progress);
        }
      }

      return {
        success: true,
        data: results,
      };
    } catch (error) {
      console.error('Failed to bulk create animations:', error);
      return {
        success: false,
        error: {
          type: 'UNKNOWN',
          message: 'Failed to bulk create animations',
          details: error,
        },
      };
    }
  }

  /**
   * Bulk delete animations
   */
  async bulkDelete(
    ids: number[],
    options?: BulkOperationOptions
  ): Promise<DatabaseOperationResult<void>> {
    const batchSize = options?.batchSize || 50;
    const continueOnError = options?.continueOnError ?? true;
    const errors: unknown[] = [];

    try {
      const total = ids.length;

      for (let i = 0; i < total; i += batchSize) {
        const batch = ids.slice(i, i + batchSize);

        try {
          await this.db.animations.bulkDelete(batch);
        } catch (error) {
          if (continueOnError) {
            errors.push(error);
            // Try deleting one by one
            for (const id of batch) {
              try {
                await this.db.animations.delete(id);
              } catch (err) {
                errors.push(err);
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
      console.error('Failed to bulk delete animations:', error);
      return {
        success: false,
        error: {
          type: 'UNKNOWN',
          message: 'Failed to bulk delete animations',
          details: error,
        },
      };
    }
  }

  /**
   * Count animations
   */
  async count(): Promise<number> {
    try {
      return await this.db.animations.count();
    } catch (error) {
      console.error('Failed to count animations:', error);
      return 0;
    }
  }

  /**
   * Clear all animations
   */
  async clear(): Promise<DatabaseOperationResult<void>> {
    try {
      await this.db.animations.clear();

      return {
        success: true,
      };
    } catch (error) {
      console.error('Failed to clear animations:', error);
      return {
        success: false,
        error: {
          type: 'UNKNOWN',
          message: 'Failed to clear animations',
          details: error,
        },
      };
    }
  }
}

/**
 * Animation repository singleton
 */
let animationRepositoryInstance: AnimationRepository | null = null;

/**
 * Get animation repository instance
 */
export function getAnimationRepository(): AnimationRepository {
  if (!animationRepositoryInstance) {
    animationRepositoryInstance = new AnimationRepository();
  }
  return animationRepositoryInstance;
}
