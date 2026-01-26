/**
 * Database Migrations
 * Manages database schema versioning and migrations
 */

import { Dexie, Table } from 'dexie';

/**
 * Migration Context
 * Provides access to database during migration
 */
export interface MigrationContext {
  db: Dexie;
}

/**
 * Migration Definition
 * Defines a single database migration
 */
export interface Migration {
  version: number;
  name: string;
  description: string;
  up: (ctx: MigrationContext) => Promise<void>;
  down?: (ctx: MigrationContext) => Promise<void>;
}

/**
 * Migration Result
 */
export interface MigrationResult {
  version: number;
  success: boolean;
  error?: string;
}

/**
 * All database migrations
 * Ordered by version number
 */
export const MIGRATIONS: Migration[] = [
  {
    version: 3,
    name: 'add_asset_type_and_extended_formats',
    description: 'Add assetType field and extend supported formats',
    up: async (ctx: MigrationContext) => {
      const { db } = ctx;

      // Add assetType to models table
      // This is handled automatically by Dexie when we update the schema
      // But we need to migrate existing data
      const models = await db.table('models').toArray();

      for (const model of models as any[]) {
        // Set default assetType based on existing data
        if (!model.assetType) {
          // VRM files are typically characters
          model.assetType = model.format === 'vrm' ? 'character' : 'other';
          await db.table('models').put(model);
        }
      }
    },
    down: async (ctx: MigrationContext) => {
      // Remove assetType field
      const { db } = ctx;
      const models = await db.table('models').toArray();
      for (const model of models as any[]) {
        delete model.assetType;
        await db.table('models').put(model);
      }
    },
  },
  {
    version: 4,
    name: 'add_skeleton_metadata',
    description: 'Add skeleton type and bone count metadata',
    up: async (ctx: MigrationContext) => {
      const { db } = ctx;
      const models = await db.table('models').toArray();

      for (const model of models as any[]) {
        if (!model.skeletonMetadata) {
          // Default skeleton metadata for existing models
          model.skeletonMetadata = {
            type: 'unknown',
            boneCount: 0,
          };
          await db.table('models').put(model);
        }
      }
    },
    down: async (ctx: MigrationContext) => {
      const { db } = ctx;
      const models = await db.table('models').toArray();
      for (const model of models as any[]) {
        delete model.skeletonMetadata;
        await db.table('models').put(model);
      }
    },
  },
];

/**
 * Migration Manager
 * Handles database migrations
 */
export class MigrationManager {
  private currentVersion: number;
  private targetVersion: number;

  constructor(currentVersion: number, targetVersion?: number) {
    this.currentVersion = currentVersion;
    this.targetVersion = targetVersion || MIGRATIONS[MIGRATIONS.length - 1].version;
  }

  /**
   * Get pending migrations
   */
  getPendingMigrations(): Migration[] {
    return MIGRATIONS.filter(
      (m) => m.version > this.currentVersion && m.version <= this.targetVersion
    );
  }

  /**
   * Run all pending migrations
   */
  async runMigrations(db: Dexie): Promise<MigrationResult[]> {
    const pending = this.getPendingMigrations();
    const results: MigrationResult[] = [];

    for (const migration of pending) {
      try {
        console.log(`Running migration ${migration.version}: ${migration.name}`);

        // Run migration in a transaction
        await db.transaction(
          'rw',
          db.tables as Table<any, any>[],
          async () => {
            await migration.up({ db });
          }
        );

        results.push({
          version: migration.version,
          success: true,
        });

        console.log(`Migration ${migration.version} completed successfully`);
      } catch (error) {
        console.error(`Migration ${migration.version} failed:`, error);
        results.push({
          version: migration.version,
          success: false,
          error: String(error),
        });
        throw error; // Stop on failure
      }
    }

    return results;
  }

  /**
   * Rollback a specific migration
   */
  async rollbackMigration(db: Dexie, version: number): Promise<void> {
    const migration = MIGRATIONS.find((m) => m.version === version);

    if (!migration) {
      throw new Error(`Migration ${version} not found`);
    }

    if (!migration.down) {
      throw new Error(`Migration ${version} does not support rollback`);
    }

    console.log(`Rolling back migration ${version}: ${migration.name}`);

    await db.transaction(
      'rw',
      db.tables as Table<any, any>[],
      async () => {
        await migration.down!({ db });
      }
    );

    console.log(`Migration ${version} rolled back successfully`);
  }

  /**
   * Get migration by version
   */
  getMigration(version: number): Migration | undefined {
    return MIGRATIONS.find((m) => m.version === version);
  }

  /**
   * Get all migrations
   */
  getAllMigrations(): Migration[] {
    return [...MIGRATIONS];
  }
}

/**
 * Migration utilities
 */
export const MigrationUtils = {
  /**
   * Add column to all records in a table
   */
  async addColumn(
    db: Dexie,
    tableName: string,
    columnName: string,
    defaultValue: any
  ): Promise<void> {
    const table = db.table(tableName);
    const records = await table.toArray();

    for (const record of records) {
      if (!(columnName in record)) {
        (record as any)[columnName] = defaultValue;
        await table.put(record);
      }
    }
  },

  /**
   * Remove column from all records in a table
   */
  async removeColumn(
    db: Dexie,
    tableName: string,
    columnName: string
  ): Promise<void> {
    const table = db.table(tableName);
    const records = await table.toArray();

    for (const record of records) {
      if (columnName in record) {
        delete (record as any)[columnName];
        await table.put(record);
      }
    }
  },

  /**
   * Rename column in all records
   */
  async renameColumn(
    db: Dexie,
    tableName: string,
    oldName: string,
    newName: string
  ): Promise<void> {
    const table = db.table(tableName);
    const records = await table.toArray();

    for (const record of records) {
      if (oldName in record) {
        (record as any)[newName] = (record as any)[oldName];
        delete (record as any)[oldName];
        await table.put(record);
      }
    }
  },

  /**
   * Transform column values
   */
  async transformColumn(
    db: Dexie,
    tableName: string,
    columnName: string,
    transformer: (value: any) => any
  ): Promise<void> {
    const table = db.table(tableName);
    const records = await table.toArray();

    for (const record of records) {
      if (columnName in record) {
        (record as any)[columnName] = transformer((record as any)[columnName]);
        await table.put(record);
      }
    }
  },
};

/**
 * Migration examples
 */
export const MigrationExamples = {
  /**
   * Example: Add new indexed field
   */
  async addIndexedField(db: Dexie): Promise<void> {
    await MigrationUtils.addColumn(db, 'models', 'assetType', 'other');
    // Note: Index must be added to schema definition
  },

  /**
   * Example: Change field type (string to number)
   */
  async changeFieldType(db: Dexie): Promise<void> {
    await MigrationUtils.transformColumn(db, 'models', 'size', (value) => {
      // Convert string size to number
      return typeof value === 'string' ? parseInt(value, 10) : value;
    });
  },

  /**
   * Example: Merge two fields
   */
  async mergeFields(db: Dexie): Promise<void> {
    const table = db.table('models');
    const records = await table.toArray();

    for (const record of records as any[]) {
      const { firstName, lastName } = record;
      if (firstName || lastName) {
        record.fullName = `${firstName || ''} ${lastName || ''}`.trim();
        delete record.firstName;
        delete record.lastName;
        await table.put(record);
      }
    }
  },

  /**
   * Example: Split field into multiple fields
   */
  async splitField(db: Dexie): Promise<void> {
    const table = db.table('models');
    const records = await table.toArray();

    for (const record of records as any[]) {
      if (record.fullName) {
        const parts = record.fullName.split(' ');
        record.firstName = parts[0] || '';
        record.lastName = parts.slice(1).join(' ') || '';
        delete record.fullName;
        await table.put(record);
      }
    }
  },

  /**
   * Example: Backfill missing data
   */
  async backfillData(db: Dexie): Promise<void> {
    const table = db.table('models');
    const records = await table.toArray();

    for (const record of records as any[]) {
      if (!record.thumbnail) {
        // Generate thumbnail from model data
        record.thumbnail = await this.generateThumbnail(record.data);
        await table.put(record);
      }
    }
  },

  /**
   * Example: Clean up orphaned records
   */
  async cleanupOrphans(db: Dexie): Promise<void> {
    // Find thumbnails without models
    const thumbnails = await db.table('thumbnails').toArray();
    const models = await db.table('models').toArray();
    const modelUuids = new Set(models.map((m: any) => m.uuid));

    for (const thumbnail of thumbnails as any[]) {
      if (!modelUuids.has(thumbnail.targetUuid)) {
        await db.table('thumbnails').delete(thumbnail.id);
      }
    }
  },

  async generateThumbnail(_data: ArrayBuffer): Promise<string> {
    // Thumbnail generation logic
    return '';
  },
};
