/**
 * LocalStorage Persistence for Zustand
 * Provides type-safe persistence to localStorage
 * 
 * This module creates a custom storage adapter for Zustand's persist middleware
 * that stores data in localStorage.
 */

import { DatabaseError } from '../../types/database.types';

/**
 * Storage adapter for LocalStorage
 * Implements Zustand persist storage API using localStorage
 */
export class LocalStorageStorage {
  private storeName: string;

  constructor(storeName: string) {
    this.storeName = `zustand_${storeName}`;
  }

  /**
   * Get item from LocalStorage
   */
  async getItem(key: string): Promise<string | null> {
    try {
      const localStorageKey = `${this.storeName}_${key}`;
      const value = localStorage.getItem(localStorageKey);
      
      if (value) {
        console.debug(`[LocalStorage Storage] Retrieved ${key} for ${this.storeName}`);
        return value;
      }

      return null;
    } catch (error) {
      console.error('[LocalStorage Storage] Error getting item:', error);
      throw this.createError('Failed to get item from storage', error);
    }
  }

  /**
   * Set item in LocalStorage
   */
  async setItem(key: string, value: string): Promise<void> {
    try {
      const localStorageKey = `${this.storeName}_${key}`;
      localStorage.setItem(localStorageKey, value);
      console.debug(`[LocalStorage Storage] Saved ${key} for ${this.storeName}`);
    } catch (error) {
      console.error('[LocalStorage Storage] Error setting item:', error);
      throw this.createError('Failed to set item in storage', error);
    }
  }

  /**
   * Remove item from LocalStorage
   */
  async removeItem(key: string): Promise<void> {
    try {
      const localStorageKey = `${this.storeName}_${key}`;
      localStorage.removeItem(localStorageKey);
      console.debug(`[LocalStorage Storage] Removed ${key} for ${this.storeName}`);
    } catch (error) {
      console.error('[LocalStorage Storage] Error removing item:', error);
      throw this.createError('Failed to remove item from storage', error);
    }
  }

  /**
   * Create a database error
   */
  private createError(message: string, details: unknown): Error {
    const dbError: DatabaseError = {
      type: 'TRANSACTION_ERROR',
      message,
      details,
    };
    return new Error(dbError.message);
  }
}

/**
 * Create LocalStorage storage adapter for Zustand persist
 * 
 * @param storeName - Name of the store (used as prefix for storage keys)
 * @returns Storage adapter compatible with Zustand persist middleware
 * 
 * @example
 * ```typescript
 * import { createLocalStorageStorage } from './store/persist/localStoragePersist';
 * 
 * const useMyStore = create<MyState>()(
 *   persist(
 *     (set) => ({
 *       // state...
 *     }),
 *     {
 *       name: 'my-store',
 *       storage: createLocalStorageStorage('my-store'),
 *     }
 *   )
 * );
 * ```
 */
export function createLocalStorageStorage(
  storeName: string
): LocalStorageStorage {
  return new LocalStorageStorage(storeName);
}

/**
 * LocalStorage Persist Configuration
 * Configuration options for LocalStorage persistence
 */
export interface LocalStoragePersistConfig {
  /**
   * Name of the store (used for storage key)
   */
  name: string;

  /**
   * Version of the storage schema (for migrations)
   */
  version?: number;

  /**
   * Called after state is successfully loaded from storage
   */
  onRehydrateStorage?: (state?: unknown) => void;

  /**
   * Called if there's an error during persistence
   */
  onError?: (error: Error) => void;
}

/**
 * Create persist configuration with LocalStorage storage
 * 
 * @param config - Configuration options
 * @returns Persist configuration object for Zustand
 * 
 * @example
 * ```typescript
 * const persistConfig = createLocalStoragePersistConfig({
 *   name: 'model-library',
 *   version: 1,
 *   onRehydrateStorage: (state) => {
 *     console.log('State rehydrated:', state);
 *   },
 *   onError: (error) => {
 *     console.error('Persistence error:', error);
 *   },
 * });
 * 
 * const useModelLibraryStore = create<ModelLibraryState>()(
 *   persist(
 *     (set) => ({
 *       // state...
 *     }),
 *     persistConfig
 *   )
 * );
 * ```
 */
export function createLocalStoragePersistConfig(
  config: LocalStoragePersistConfig
): {
  name: string;
  storage: LocalStorageStorage;
  version: number;
  onRehydrateStorage?: (state?: unknown) => void;
  onError?: (error: Error) => void;
} {
  return {
    name: config.name,
    storage: createLocalStorageStorage(config.name),
    version: config.version || 1,
    onRehydrateStorage: config.onRehydrateStorage,
    onError: config.onError,
  };
}

/**
 * Clear persisted state for a store
 * 
 * @param storeName - Name of the store to clear
 */
export async function clearPersistedState(storeName: string): Promise<void> {
  try {
    const storage = createLocalStorageStorage(storeName);
    await storage.removeItem('state');
    console.debug(`[LocalStorage Persist] Cleared state for ${storeName}`);
  } catch (error) {
    console.error('[LocalStorage Persist] Error clearing state:', error);
    throw error;
  }
}

/**
 * Check if persisted state exists for a store
 * 
 * @param storeName - Name of the store to check
 * @returns True if persisted state exists
 */
export async function hasPersistedState(storeName: string): Promise<boolean> {
  try {
    const storage = createLocalStorageStorage(storeName);
    const value = await storage.getItem('state');
    return value !== null;
  } catch (error) {
    console.error('[LocalStorage Persist] Error checking persisted state:', error);
    return false;
  }
}

/**
 * Get raw persisted state for a store
 * 
 * @param storeName - Name of the store
 * @returns The persisted state or null
 */
export async function getPersistedState(storeName: string): Promise<string | null> {
  try {
    const storage = createLocalStorageStorage(storeName);
    return await storage.getItem('state');
  } catch (error) {
    console.error('[LocalStorage Persist] Error getting persisted state:', error);
    return null;
  }
}
