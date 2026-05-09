/**
 * Preferences Service
 * High-level operations for user preferences
 */

import { getDatabaseService } from '../DatabaseService';
import { PreferenceRecord } from '../schemas/databaseSchema';
import {
  DatabaseOperationResult,
} from '../../../types/database.types';

/**
 * Preferences Service
 * Provides high-level preference operations
 */
export class PreferencesService {
  private dbService = getDatabaseService();

  /**
   * Initialize service
   */
  async initialize(): Promise<void> {
    await this.dbService.initialize();
  }

  /**
   * Get preference by key
   */
  async getPreference<T = unknown>(key: string): Promise<DatabaseOperationResult<T>> {
    await this.initialize();

    try {
      const db = this.dbService.getDatabase();
      const preferences = await db.preferences
        .where('key')
        .equals(key)
        .first();

      if (!preferences) {
        return {
          success: true,
          data: undefined as T,
        };
      }

      const value = JSON.parse(preferences.value) as T;
      return {
        success: true,
        data: value,
      };
    } catch (error) {
      console.error('Failed to get preference:', error);
      return {
        success: false,
        error: {
          type: 'UNKNOWN',
          message: 'Failed to get preference',
          details: error,
        },
      };
    }
  }

  /**
   * Set preference
   */
  async setPreference<T>(key: string, value: T): Promise<DatabaseOperationResult<void>> {
    await this.initialize();

    try {
      const db = this.dbService.getDatabase();
      const existing = await db.preferences
        .where('key')
        .equals(key)
        .first();

      const preference: PreferenceRecord = {
        key,
        value: JSON.stringify(value),
        updatedAt: new Date(),
      };

      if (existing) {
        preference.id = existing.id;
        await db.preferences.put(preference);
      } else {
        await db.preferences.add(preference);
      }

      return {
        success: true,
      };
    } catch (error) {
      console.error('Failed to set preference:', error);
      return {
        success: false,
        error: {
          type: 'UNKNOWN',
          message: 'Failed to set preference',
          details: error,
        },
      };
    }
  }

  /**
   * Delete preference
   */
  async deletePreference(key: string): Promise<DatabaseOperationResult<void>> {
    await this.initialize();

    try {
      const db = this.dbService.getDatabase();
      await db.preferences
        .where('key')
        .equals(key)
        .delete();

      return {
        success: true,
      };
    } catch (error) {
      console.error('Failed to delete preference:', error);
      return {
        success: false,
        error: {
          type: 'UNKNOWN',
          message: 'Failed to delete preference',
          details: error,
        },
      };
    }
  }

  /**
   * Get all preferences
   */
  async getAllPreferences(): Promise<DatabaseOperationResult<Record<string, unknown>>> {
    await this.initialize();

    try {
      const db = this.dbService.getDatabase();
      const preferences = await db.preferences.toArray();

      const result: Record<string, unknown> = {};
      for (const pref of preferences) {
        result[pref.key] = JSON.parse(pref.value);
      }

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      console.error('Failed to get all preferences:', error);
      return {
        success: false,
        error: {
          type: 'UNKNOWN',
          message: 'Failed to get all preferences',
          details: error,
        },
      };
    }
  }

  /**
   * Clear all preferences
   */
  async clearAllPreferences(): Promise<DatabaseOperationResult<void>> {
    await this.initialize();

    try {
      const db = this.dbService.getDatabase();
      await db.preferences.clear();

      return {
        success: true,
      };
    } catch (error) {
      console.error('Failed to clear all preferences:', error);
      return {
        success: false,
        error: {
          type: 'UNKNOWN',
          message: 'Failed to clear all preferences',
          details: error,
        },
      };
    }
  }
}

/**
 * Preferences service singleton
 */
let preferencesServiceInstance: PreferencesService | null = null;

/**
 * Get preferences service instance
 */
export function getPreferencesService(): PreferencesService {
  if (!preferencesServiceInstance) {
    preferencesServiceInstance = new PreferencesService();
  }
  return preferencesServiceInstance;
}
