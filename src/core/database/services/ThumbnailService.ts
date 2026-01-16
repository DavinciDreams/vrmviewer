/**
 * Thumbnail Service
 * Handles thumbnail generation and storage
 */

import { getDatabase } from '../schemas/databaseSchema';
import { getDatabaseService } from '../DatabaseService';
import {
  ThumbnailRecord,
  DatabaseOperationResult,
} from '../../../types/database.types';

/**
 * Thumbnail Service
 * Provides thumbnail generation and storage
 */
export class ThumbnailService {
  private db = getDatabase();
  private dbService = getDatabaseService();

  /**
   * Initialize service
   */
  async initialize(): Promise<void> {
    await this.dbService.initialize();
  }

  /**
   * Save thumbnail
   */
  async saveThumbnail(thumbnail: Omit<ThumbnailRecord, 'id'>): Promise<DatabaseOperationResult<ThumbnailRecord>> {
    await this.initialize();

    try {
      const id = await this.db.thumbnails.add(thumbnail);
      const saved = await this.db.thumbnails.get(id);

      return {
        success: true,
        data: saved,
      };
    } catch (error) {
      console.error('Failed to save thumbnail:', error);
      return {
        success: false,
        error: {
          type: 'UNKNOWN',
          message: 'Failed to save thumbnail',
          details: error,
        },
      };
    }
  }

  /**
   * Get thumbnail by UUID
   */
  async getThumbnail(uuid: string): Promise<DatabaseOperationResult<ThumbnailRecord>> {
    await this.initialize();

    try {
      const thumbnail = await this.db.thumbnails.where('uuid').equals(uuid).first();

      if (!thumbnail) {
        return {
          success: false,
          error: {
            type: 'NOT_FOUND',
            message: `Thumbnail with UUID ${uuid} not found`,
          },
        };
      }

      return {
        success: true,
        data: thumbnail,
      };
    } catch (error) {
      console.error('Failed to get thumbnail:', error);
      return {
        success: false,
        error: {
          type: 'UNKNOWN',
          message: 'Failed to get thumbnail',
          details: error,
        },
      };
    }
  }

  /**
   * Get thumbnail by target
   */
  async getThumbnailByTarget(targetUuid: string): Promise<DatabaseOperationResult<ThumbnailRecord>> {
    await this.initialize();

    try {
      const thumbnail = await this.db.thumbnails.where('targetUuid').equals(targetUuid).first();

      if (!thumbnail) {
        return {
          success: false,
          error: {
            type: 'NOT_FOUND',
            message: `Thumbnail for target ${targetUuid} not found`,
          },
        };
      }

      return {
        success: true,
        data: thumbnail,
      };
    } catch (error) {
      console.error('Failed to get thumbnail by target:', error);
      return {
        success: false,
        error: {
          type: 'UNKNOWN',
          message: 'Failed to get thumbnail by target',
          details: error,
        },
      };
    }
  }

  /**
   * Get all thumbnails
   */
  async getAllThumbnails(): Promise<DatabaseOperationResult<ThumbnailRecord[]>> {
    await this.initialize();

    try {
      const thumbnails = await this.db.thumbnails.toArray();

      return {
        success: true,
        data: thumbnails,
      };
    } catch (error) {
      console.error('Failed to get all thumbnails:', error);
      return {
        success: false,
        error: {
          type: 'UNKNOWN',
          message: 'Failed to get all thumbnails',
          details: error,
        },
      };
    }
  }

  /**
   * Get thumbnails by type
   */
  async getThumbnailsByType(type: 'animation' | 'model'): Promise<DatabaseOperationResult<ThumbnailRecord[]>> {
    await this.initialize();

    try {
      const thumbnails = await this.db.thumbnails.where('type').equals(type).toArray();

      return {
        success: true,
        data: thumbnails,
      };
    } catch (error) {
      console.error('Failed to get thumbnails by type:', error);
      return {
        success: false,
        error: {
          type: 'UNKNOWN',
          message: 'Failed to get thumbnails by type',
          details: error,
        },
      };
    }
  }

  /**
   * Delete thumbnail
   */
  async deleteThumbnail(uuid: string): Promise<DatabaseOperationResult<void>> {
    await this.initialize();

    try {
      const thumbnail = await this.db.thumbnails.where('uuid').equals(uuid).first();

      if (!thumbnail) {
        return {
          success: false,
          error: {
            type: 'NOT_FOUND',
            message: `Thumbnail with UUID ${uuid} not found`,
          },
        };
      }

      await this.db.thumbnails.delete(thumbnail.id!);

      return {
        success: true,
      };
    } catch (error) {
      console.error('Failed to delete thumbnail:', error);
      return {
        success: false,
        error: {
          type: 'UNKNOWN',
          message: 'Failed to delete thumbnail',
          details: error,
        },
      };
    }
  }

  /**
   * Delete thumbnail by target
   */
  async deleteThumbnailByTarget(targetUuid: string): Promise<DatabaseOperationResult<void>> {
    await this.initialize();

    try {
      const thumbnail = await this.db.thumbnails.where('targetUuid').equals(targetUuid).first();

      if (!thumbnail) {
        return {
          success: false,
          error: {
            type: 'NOT_FOUND',
            message: `Thumbnail for target ${targetUuid} not found`,
          },
        };
      }

      await this.db.thumbnails.delete(thumbnail.id!);

      return {
        success: true,
      };
    } catch (error) {
      console.error('Failed to delete thumbnail by target:', error);
      return {
        success: false,
        error: {
          type: 'UNKNOWN',
          message: 'Failed to delete thumbnail by target',
          details: error,
        },
      };
    }
  }

  /**
   * Clear thumbnails by type
   */
  async clearThumbnailsByType(type: 'animation' | 'model'): Promise<DatabaseOperationResult<void>> {
    await this.initialize();

    try {
      const thumbnails = await this.db.thumbnails.where('type').equals(type).toArray();
      const ids = thumbnails.map((t) => t.id).filter((id): id is number => id !== undefined);

      await this.db.thumbnails.bulkDelete(ids);

      return {
        success: true,
      };
    } catch (error) {
      console.error('Failed to clear thumbnails by type:', error);
      return {
        success: false,
        error: {
          type: 'UNKNOWN',
          message: 'Failed to clear thumbnails by type',
          details: error,
        },
      };
    }
  }

  /**
   * Clear all thumbnails
   */
  async clearAllThumbnails(): Promise<DatabaseOperationResult<void>> {
    await this.initialize();

    try {
      await this.db.thumbnails.clear();

      return {
        success: true,
      };
    } catch (error) {
      console.error('Failed to clear all thumbnails:', error);
      return {
        success: false,
        error: {
          type: 'UNKNOWN',
          message: 'Failed to clear all thumbnails',
          details: error,
        },
      };
    }
  }

  /**
   * Count thumbnails
   */
  async countThumbnails(): Promise<number> {
    await this.initialize();

    try {
      return await this.db.thumbnails.count();
    } catch (error) {
      console.error('Failed to count thumbnails:', error);
      return 0;
    }
  }

  /**
   * Get thumbnails for targets
   */
  async getThumbnailsForTargets(targetUuids: string[]): Promise<DatabaseOperationResult<ThumbnailRecord[]>> {
    await this.initialize();

    try {
      const thumbnails: ThumbnailRecord[] = [];

      for (const uuid of targetUuids) {
        const result = await this.getThumbnailByTarget(uuid);
        if (result.success && result.data) {
          thumbnails.push(result.data);
        }
      }

      return {
        success: true,
        data: thumbnails,
      };
    } catch (error) {
      console.error('Failed to get thumbnails for targets:', error);
      return {
        success: false,
        error: {
          type: 'UNKNOWN',
          message: 'Failed to get thumbnails for targets',
          details: error,
        },
      };
    }
  }

  /**
   * Bulk delete thumbnails
   */
  async bulkDeleteThumbnails(uuids: string[]): Promise<DatabaseOperationResult<void>> {
    await this.initialize();

    try {
      for (const uuid of uuids) {
        await this.deleteThumbnail(uuid);
      }

      return {
        success: true,
      };
    } catch (error) {
      console.error('Failed to bulk delete thumbnails:', error);
      return {
        success: false,
        error: {
          type: 'UNKNOWN',
          message: 'Failed to bulk delete thumbnails',
          details: error,
        },
      };
    }
  }
}

/**
 * Thumbnail service singleton
 */
let thumbnailServiceInstance: ThumbnailService | null = null;

/**
 * Get thumbnail service instance
 */
export function getThumbnailService(): ThumbnailService {
  if (!thumbnailServiceInstance) {
    thumbnailServiceInstance = new ThumbnailService();
  }
  return thumbnailServiceInstance;
}
