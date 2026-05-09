/**
 * IndexedDB Persistence for Zustand
 *
 * Storage adapter for Zustand's `persist` middleware that writes to IndexedDB
 * (via the existing Dexie-backed `VRMViewerDB.persistedState` table) instead
 * of localStorage. Use this for state payloads that exceed the ~5MB localStorage
 * cap or that need to survive in IndexedDB alongside the rest of the app data.
 */

import { getDatabase } from '../../core/database/schemas/databaseSchema';
import { DatabaseError } from '../../types/database.types';

/**
 * Build the row key for a given store + entry name.
 * Keys are namespaced so multiple Zustand stores can share the table.
 */
function buildKey(storeName: string, key: string): string {
  return `zustand:${storeName}:${key}`;
}

/**
 * Storage adapter for IndexedDB.
 * Implements Zustand's `StateStorage` interface (string get/set/remove).
 */
export class IndexedDBStorage {
  private storeName: string;

  constructor(storeName: string) {
    this.storeName = storeName;
  }

  async getItem(key: string): Promise<string | null> {
    try {
      const row = await getDatabase().persistedState.get(buildKey(this.storeName, key));
      return row?.value ?? null;
    } catch (error) {
      console.error('[IndexedDB Storage] Error getting item:', error);
      throw this.createError('Failed to get item from storage', error);
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    try {
      await getDatabase().persistedState.put({
        key: buildKey(this.storeName, key),
        value,
        updatedAt: new Date(),
      });
    } catch (error) {
      console.error('[IndexedDB Storage] Error setting item:', error);
      throw this.createError('Failed to set item in storage', error);
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      await getDatabase().persistedState.delete(buildKey(this.storeName, key));
    } catch (error) {
      console.error('[IndexedDB Storage] Error removing item:', error);
      throw this.createError('Failed to remove item from storage', error);
    }
  }

  private createError(message: string, details: unknown): Error {
    if (details instanceof DOMException && details.name === 'QuotaExceededError') {
      const quotaError: DatabaseError = {
        type: 'QUOTA_EXCEEDED',
        message: 'IndexedDB storage quota exceeded',
        details,
      };
      return new Error(quotaError.message);
    }
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
 * @param storeName - Name of the store (used as namespace for storage keys)
 * @returns Storage adapter compatible with Zustand persist middleware
 *
 * @example
 * ```typescript
 * import { createIndexedDBStorage } from './store/persist/indexedDBPersist';
 *
 * const useMyStore = create<MyState>()(
 *   persist(
 *     (set) => ({ /* state... *\/ }),
 *     {
 *       name: 'my-store',
 *       storage: createIndexedDBStorage('my-store'),
 *     }
 *   )
 * );
 * ```
 */
export function createIndexedDBStorage(storeName: string): IndexedDBStorage {
  return new IndexedDBStorage(storeName);
}

/**
 * IndexedDB Persist Configuration
 */
export interface IndexedDBPersistConfig {
  /** Name of the store (used for storage key namespace) */
  name: string;
  /** Version of the storage schema (for migrations) */
  version?: number;
  /** Called after state is successfully loaded from storage */
  onRehydrateStorage?: (state?: unknown) => void;
  /** Called if there's an error during persistence */
  onError?: (error: Error) => void;
}

/**
 * Create persist configuration with IndexedDB storage
 */
export function createIndexedDBPersistConfig(config: IndexedDBPersistConfig): {
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
 */
export async function clearPersistedState(storeName: string): Promise<void> {
  try {
    const storage = createIndexedDBStorage(storeName);
    await storage.removeItem('state');
  } catch (error) {
    console.error('[IndexedDB Persist] Error clearing state:', error);
    throw error;
  }
}

/**
 * Check if persisted state exists for a store
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
