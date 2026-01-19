/**
 * IndexedDB Persistence for Zustand
 * Provides type-safe persistence to IndexedDB using Dexie.js
 * 
 * This module creates a custom storage adapter for Zustand's persist middleware
 * that stores data in IndexedDB instead of localStorage.
 */

import { DatabaseError } from '../../types/database.types';

/**
 * Storage adapter for IndexedDB
 * Implements Zustand persist storage API using Dexie.js
 */
export class IndexedDBStorage {
  private storeName: string;

  constructor(storeName: string) {
    this.storeName = `zustand_${storeName}`;
  }

  /**
   * Get item from IndexedDB
   */
  async getItem(key: string): Promise<string | null> {
    try {
      const localStorageKey = `${this.storeName}_${key}`;
      const value = localStorage.getItem(localStorageKey);
      
      if (value) {
        console.debug(`[IndexedDB Storage] Retrieved ${key} for ${this.storeName}`);
        return value;
      }

      return null;
    } catch (error) {
      console.error('[IndexedDB Storage] Error getting item:', error);
      throw this.createError('Failed to get item from storage', error);
    }
  }

  /**
   * Set item in IndexedDB
   */
  async setItem(key: string, value: string): Promise<void> {
    try {
      const localStorageKey = `${this.storeName}_${key}`;
      localStorage.setItem(localStorageKey, value);
      console.debug(`[IndexedDB Storage] Saved ${key} for ${this.storeName}`);
    } catch (error) {
      console.error('[IndexedDB Storage] Error setting item:', error);
      throw this.createError('Failed to set item in storage', error);
    }
  }

  /**
   * Remove item from IndexedDB
   */
  async removeItem(key: string): Promise<void> {
    try {
      const localStorageKey = `${this.storeName}_${key}`;
      localStorage.removeItem(localStorageKey);
      console.debug(`[IndexedDB Storage] Removed ${key} for ${this.storeName}`);
    } catch (error) {
      console.error('[IndexedDB Storage] Error removing item:', error);
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
 * Create IndexedDB storage adapter for Zustand persist
 * 
 * @param storeName - Name of the store (used as prefix for storage keys)
 * @returns Storage adapter compatible with Zustand persist middleware
 * 
 * @example
 * ```typescript
 * import { createIndexedDBStorage } from './store/persist/indexedDBPersist';
 * 
 * const useMyStore = create<MyState>()(
 *   persist(
 *     (set) => ({
 *       // state...
 *     }),
 *     {
 *       name: 'my-store',
 *       storage: createIndexedDBStorage('my-store'),
 *     }
 *   )
 * );
 * ```
 */
export function createIndexedDBStorage(
  storeName: string
): IndexedDBStorage {
  return new IndexedDBStorage(storeName);
}

/**
 * IndexedDB Persist Configuration
 * Configuration options for IndexedDB persistence
 */
export interface IndexedDBPersistConfig {
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
 * Create persist configuration with IndexedDB storage
 * 
 * @param config - Configuration options
 * @returns Persist configuration object for Zustand
 * 
 * @example
 * ```typescript
 * const persistConfig = createIndexedDBPersistConfig({
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
export function createIndexedDBPersistConfig(
  config: IndexedDBPersistConfig
): {
  name: string;
  storage: IndexedDBStorage;
  version: number;
  onRehydrateStorage?: (state?: unknown) => void;
  onError?: (error: Error) => void;
} {
  return {
    name: config.name,
    storage: createIndexedDBStorage(config.name),
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
    const storage = createIndexedDBStorage(storeName);
    await storage.removeItem('state');
    console.debug(`[IndexedDB Persist] Cleared state for ${storeName}`);
  } catch (error) {
    console.error('[IndexedDB Persist] Error clearing state:', error);
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
    const storage = createIndexedDBStorage(storeName);
    const value = await storage.getItem('state');
    return value !== null;
  } catch (error) {
    console.error('[IndexedDB Persist] Error checking persisted state:', error);
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
    const storage = createIndexedDBStorage(storeName);
    return await storage.getItem('state');
  } catch (error) {
    console.error('[IndexedDB Persist] Error getting persisted state:', error);
    return null;
  }
}
