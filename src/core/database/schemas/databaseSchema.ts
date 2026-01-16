/**
 * Database Schema
 * Defines the Dexie.js database schema for VRM Viewer
 */

import Dexie, { Table } from 'dexie';
import { AnimationRecord, ModelRecord, ThumbnailRecord } from '../../../types/database.types';

/**
 * VRM Viewer Database
 * Main database class extending Dexie
 */
export class VRMViewerDatabase extends Dexie {
  // Tables
  animations!: Table<AnimationRecord, number>;
  models!: Table<ModelRecord, number>;
  thumbnails!: Table<ThumbnailRecord, number>;

  constructor() {
    super('VRMViewerDB');

    // Define schema version 1
    this.version(1).stores({
      // Animations table
      animations: '++id, uuid, name, displayName, description, category, format, duration, createdAt, updatedAt, size, *tags',
      // Models table
      models: '++id, uuid, name, displayName, description, category, format, version, createdAt, updatedAt, size, *tags',
      // Thumbnails table
      thumbnails: '++id, uuid, name, type, targetUuid, createdAt',
    });
  }
}

/**
 * Database singleton instance
 */
let dbInstance: VRMViewerDatabase | null = null;

/**
 * Get database instance
 * @returns Database instance
 */
export function getDatabase(): VRMViewerDatabase {
  if (!dbInstance) {
    dbInstance = new VRMViewerDatabase();
  }
  return dbInstance;
}

/**
 * Close database connection
 */
export async function closeDatabase(): Promise<void> {
  if (dbInstance) {
    await dbInstance.close();
    dbInstance = null;
  }
}

/**
 * Delete database
 */
export async function deleteDatabase(): Promise<void> {
  if (dbInstance) {
    await dbInstance.delete();
    dbInstance = null;
  } else {
    await Dexie.delete('VRMViewerDB');
  }
}

/**
 * Database schema versions
 */
export const SCHEMA_VERSIONS = {
  CURRENT: 1,
  VERSIONS: [
    {
      version: 1,
      description: 'Initial schema with animations, models, and thumbnails tables',
    },
  ],
};

/**
 * Database configuration
 */
export const DATABASE_CONFIG = {
  NAME: 'VRMViewerDB',
  VERSION: 1,
  MAX_SIZE: 500 * 1024 * 1024, // 500MB default
  CHUNK_SIZE: 1024 * 1024, // 1MB chunks for large files
};

/**
 * Index definitions for animations table
 */
export const ANIMATION_INDEXES = {
  UUID: 'uuid',
  NAME: 'name',
  DISPLAY_NAME: 'displayName',
  DESCRIPTION: 'description',
  CATEGORY: 'category',
  FORMAT: 'format',
  DURATION: 'duration',
  CREATED_AT: 'createdAt',
  UPDATED_AT: 'updatedAt',
  SIZE: 'size',
  TAGS: '*tags',
};

/**
 * Index definitions for models table
 */
export const MODEL_INDEXES = {
  UUID: 'uuid',
  NAME: 'name',
  DISPLAY_NAME: 'displayName',
  DESCRIPTION: 'description',
  CATEGORY: 'category',
  FORMAT: 'format',
  VERSION: 'version',
  CREATED_AT: 'createdAt',
  UPDATED_AT: 'updatedAt',
  SIZE: 'size',
  TAGS: '*tags',
};

/**
 * Index definitions for thumbnails table
 */
export const THUMBNAIL_INDEXES = {
  UUID: 'uuid',
  NAME: 'name',
  TYPE: 'type',
  TARGET_UUID: 'targetUuid',
  CREATED_AT: 'createdAt',
};
