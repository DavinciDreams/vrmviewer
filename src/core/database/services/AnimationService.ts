/**
 * Animation Service
 * High-level operations for animations
 */

import { getAnimationRepository } from '../repositories/AnimationRepository';
import { getDatabaseService } from '../DatabaseService';
import { getThumbnailService } from './ThumbnailService';
import {
  AnimationRecord,
  DatabaseOperationResult,
  DatabaseQueryOptions,
  DatabaseQueryResult,
} from '../../../types/database.types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Animation Service
 * Provides high-level animation operations
 */
export class AnimationService {
  private repository = getAnimationRepository();
  private dbService = getDatabaseService();
  private thumbnailService = getThumbnailService();

  /**
   * Initialize service
   */
  async initialize(): Promise<void> {
    await this.dbService.initialize();
  }

  /**
   * Save animation with metadata
   */
  async saveAnimation(
    animation: Omit<AnimationRecord, 'id' | 'uuid' | 'createdAt' | 'updatedAt'>,
    thumbnail?: string
  ): Promise<DatabaseOperationResult<AnimationRecord>> {
    await this.initialize();

    try {
      // Save animation
      const result = await this.repository.create(animation);

      if (!result.success || !result.data) {
        return result;
      }

      // Save thumbnail if provided
      if (thumbnail) {
        await this.thumbnailService.saveThumbnail({
          uuid: uuidv4(),
          name: `${result.data.name}_thumbnail`,
          type: 'animation',
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
      console.error('Failed to save animation:', error);
      return {
        success: false,
        error: {
          type: 'UNKNOWN',
          message: 'Failed to save animation',
          details: error,
        },
      };
    }
  }

  /**
   * Load animation from database
   */
  async loadAnimation(uuid: string): Promise<DatabaseOperationResult<AnimationRecord>> {
    await this.initialize();

    return await this.repository.getByUuid(uuid);
  }

  /**
   * Load animation by ID
   */
  async loadAnimationById(id: number): Promise<DatabaseOperationResult<AnimationRecord>> {
    await this.initialize();

    return await this.repository.getById(id);
  }

  /**
   * Delete animation
   */
  async deleteAnimation(uuid: string): Promise<DatabaseOperationResult<void>> {
    await this.initialize();

    try {
      // Delete thumbnail
      await this.thumbnailService.deleteThumbnailByTarget(uuid);

      // Delete animation
      return await this.repository.deleteByUuid(uuid);
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
   * Update animation
   */
  async updateAnimation(
    uuid: string,
    updates: Partial<AnimationRecord>
  ): Promise<DatabaseOperationResult<AnimationRecord>> {
    await this.initialize();

    return await this.repository.updateByUuid(uuid, updates);
  }

  /**
   * Search animations
   */
  async searchAnimations(query: string): Promise<DatabaseOperationResult<AnimationRecord[]>> {
    await this.initialize();

    const result = await this.repository.query({ search: query });

    return {
      success: true,
      data: result.data,
    };
  }

  /**
   * Filter animations
   */
  async filterAnimations(options: DatabaseQueryOptions): Promise<DatabaseQueryResult<AnimationRecord>> {
    await this.initialize();

    return await this.repository.query(options);
  }

  /**
   * Get all animations
   */
  async getAllAnimations(): Promise<DatabaseOperationResult<AnimationRecord[]>> {
    await this.initialize();

    return await this.repository.getAll();
  }

  /**
   * Get animation count
   */
  async getAnimationCount(): Promise<number> {
    await this.initialize();

    return await this.repository.count();
  }

  /**
   * Get animations by category
   */
  async getAnimationsByCategory(category: string): Promise<DatabaseOperationResult<AnimationRecord[]>> {
    await this.initialize();

    const result = await this.repository.query({ category });

    return {
      success: true,
      data: result.data,
    };
  }

  /**
   * Get animations by format
   */
  async getAnimationsByFormat(format: string): Promise<DatabaseOperationResult<AnimationRecord[]>> {
    await this.initialize();

    const result = await this.repository.query({ format });

    return {
      success: true,
      data: result.data,
    };
  }

  /**
   * Get animations by tags
   */
  async getAnimationsByTags(tags: string[]): Promise<DatabaseOperationResult<AnimationRecord[]>> {
    await this.initialize();

    const result = await this.repository.query({ tags });

    return {
      success: true,
      data: result.data,
    };
  }

  /**
   * Get recent animations
   */
  async getRecentAnimations(limit = 10): Promise<DatabaseOperationResult<AnimationRecord[]>> {
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
   * Bulk save animations
   */
  async bulkSaveAnimations(
    animations: Omit<AnimationRecord, 'id' | 'uuid' | 'createdAt' | 'updatedAt'>[]
  ): Promise<DatabaseOperationResult<AnimationRecord[]>> {
    await this.initialize();

    return await this.repository.bulkCreate(animations);
  }

  /**
   * Bulk delete animations
   */
  async bulkDeleteAnimations(uuids: string[]): Promise<DatabaseOperationResult<void>> {
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

      // Delete animations
      return await this.repository.bulkDelete(ids);
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
   * Clear all animations
   */
  async clearAllAnimations(): Promise<DatabaseOperationResult<void>> {
    await this.initialize();

    try {
      // Delete all thumbnails
      await this.thumbnailService.clearThumbnailsByType('animation');

      // Clear animations
      return await this.repository.clear();
    } catch (error) {
      console.error('Failed to clear all animations:', error);
      return {
        success: false,
        error: {
          type: 'UNKNOWN',
          message: 'Failed to clear all animations',
          details: error,
        },
      };
    }
  }

  /**
   * Check if animation exists
   */
  async animationExists(name: string): Promise<boolean> {
    await this.initialize();

    const result = await this.repository.getByName(name);
    return result.success && result.data && result.data.length > 0;
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

    const categories = new Set(result.data.map((anim) => anim.category).filter(Boolean));
    return Array.from(categories);
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

    const tags = new Set(result.data.flatMap((anim) => anim.tags));
    return Array.from(tags);
  }
}

/**
 * Animation service singleton
 */
let animationServiceInstance: AnimationService | null = null;

/**
 * Get animation service instance
 */
export function getAnimationService(): AnimationService {
  if (!animationServiceInstance) {
    animationServiceInstance = new AnimationService();
  }
  return animationServiceInstance;
}
