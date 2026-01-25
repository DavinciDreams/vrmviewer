/**
 * Database Service
 * Provides database initialization, migrations, and management
 */

import { getDatabase, closeDatabase, deleteDatabase, SCHEMA_VERSIONS } from './schemas/databaseSchema';
import { MigrationManager } from './schemas/databaseMigrations';
import { DatabaseError, DatabaseStatistics } from '../../types/database.types';

/**
 * Database Service
 * Handles database initialization, migrations, and health checks
 */
export class DatabaseService {
  private db = getDatabase();
  private isInitialized = false;
  private initializationPromise: Promise<void> | null = null;

  /**
   * Initialize database
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this._initialize();

    try {
      await this.initializationPromise;
      this.isInitialized = true;
    } catch (error) {
      this.initializationPromise = null;
      throw error;
    }
  }

  /**
   * Internal initialization
   */
  private async _initialize(): Promise<void> {
    try {
      console.log(`Initializing database version ${SCHEMA_VERSIONS.CURRENT}...`);

      // Open database
      await this.db.open();

      // Check if database is ready
      if (!this.db.isOpen()) {
        const error: DatabaseError = {
          type: 'UNKNOWN',
          message: 'Failed to open database',
        };
        throw error;
      }

      // Get current database version
      const currentVersion = this.db.verno;
      console.log(`Current database version: ${currentVersion}, target version: ${SCHEMA_VERSIONS.CURRENT}`);

      // Run migrations if needed
      if (currentVersion < SCHEMA_VERSIONS.CURRENT) {
        await this.runMigrations(currentVersion);
      }

      // Verify database integrity
      await this.verifyIntegrity();

      console.log('Database initialized successfully');
    } catch (error) {
      console.error('Database initialization failed:', error);

      // Handle quota exceeded error
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        const quotaError: DatabaseError = {
          type: 'QUOTA_EXCEEDED',
          message: 'Database storage quota exceeded',
          details: error,
        };
        throw quotaError;
      }

      const initError: DatabaseError = {
        type: 'UNKNOWN',
        message: 'Failed to initialize database',
        details: error,
      };
      throw initError;
    }
  }

  /**
   * Run database migrations
   */
  private async runMigrations(currentVersion: number): Promise<void> {
    console.log(`Running migrations from version ${currentVersion} to ${SCHEMA_VERSIONS.CURRENT}...`);

    const migrationManager = new MigrationManager(currentVersion, SCHEMA_VERSIONS.CURRENT);
    const pendingMigrations = migrationManager.getPendingMigrations();

    if (pendingMigrations.length === 0) {
      console.log('No pending migrations');
      return;
    }

    console.log(`Found ${pendingMigrations.length} pending migrations:`);
    pendingMigrations.forEach((m) => {
      console.log(`  - Version ${m.version}: ${m.name} (${m.description})`);
    });

    try {
      const results = await migrationManager.runMigrations(this.db);

      console.log('Migrations completed:');
      results.forEach((r) => {
        if (r.success) {
          console.log(`  ✓ Version ${r.version}: SUCCESS`);
        } else {
          console.error(`  ✗ Version ${r.version}: FAILED - ${r.error}`);
        }
      });

      // Check if all migrations succeeded
      const failed = results.filter((r) => !r.success);
      if (failed.length > 0) {
        throw new Error(`${failed.length} migration(s) failed`);
      }
    } catch (error) {
      console.error('Migration failed:', error);
      const migrationError: DatabaseError = {
        type: 'UNKNOWN',
        message: 'Database migration failed',
        details: error,
      };
      throw migrationError;
    }
  }

  /**
   * Verify database integrity
   */
  private async verifyIntegrity(): Promise<void> {
    try {
      // Check if all tables exist
      const tableNames = this.db.tables.map((table) => table.name);
      const expectedTables = ['animations', 'models', 'thumbnails', 'preferences'];

      for (const expectedTable of expectedTables) {
        if (!tableNames.includes(expectedTable)) {
          const tableError: DatabaseError = {
            type: 'UNKNOWN',
            message: `Missing table: ${expectedTable}`,
          };
          throw tableError;
        }
      }

      // Verify indexes
      for (const table of this.db.tables) {
        await this.verifyTableIndexes(table.name);
      }

      console.log('Database integrity verified');
    } catch (error) {
      console.error('Database integrity check failed:', error);
      const integrityError: DatabaseError = {
        type: 'UNKNOWN',
        message: 'Database integrity check failed',
        details: error,
      };
      throw integrityError;
    }
  }

  /**
   * Verify table indexes
   */
  private async verifyTableIndexes(tableName: string): Promise<void> {
    try {
      this.db.table(tableName);
      // Dexie handles index verification automatically
      // Additional checks can be added here if needed
    } catch (error) {
      console.error(`Failed to verify indexes for table ${tableName}:`, error);
      const indexError: DatabaseError = {
        type: 'UNKNOWN',
        message: `Failed to verify indexes for table ${tableName}`,
        details: error,
      };
      throw indexError;
    }
  }

  /**
   * Get database instance
   */
  getDatabase() {
    return this.db;
  }

  /**
   * Check if database is ready
   */
  async isReady(): Promise<boolean> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    return this.db.isOpen();
  }

  /**
   * Get database statistics
   */
  async getStatistics(): Promise<DatabaseStatistics> {
    await this.initialize();

    try {
      const [animationCount, modelCount] = await Promise.all([
        this.db.animations.count(),
        this.db.models.count(),
      ]);

      const totalSize = await this.getTotalSize();

      // Get oldest and newest records
      const oldestAnimation = await this.db.animations.orderBy('createdAt').first();
      const newestAnimation = await this.db.animations.orderBy('createdAt').last();
      const oldestModel = await this.db.models.orderBy('createdAt').first();
      const newestModel = await this.db.models.orderBy('createdAt').last();

      const allDates = [
        oldestAnimation?.createdAt,
        newestAnimation?.createdAt,
        oldestModel?.createdAt,
        newestModel?.createdAt,
      ].filter(Boolean) as Date[];

      const oldestRecord = allDates.length > 0 ? new Date(Math.min(...allDates.map((d) => d.getTime()))) : undefined;
      const newestRecord = allDates.length > 0 ? new Date(Math.max(...allDates.map((d) => d.getTime()))) : undefined;

      // Get format counts
      const allAnimations = await this.db.animations.toArray();
      const allModels = await this.db.models.toArray();

      const formats: Record<string, number> = {};
      allAnimations.forEach((anim) => {
        formats[anim.format] = (formats[anim.format] || 0) + 1;
      });
      allModels.forEach((model) => {
        formats[model.format] = (formats[model.format] || 0) + 1;
      });

      // Get category counts
      const categories: Record<string, number> = {};
      allAnimations.forEach((anim) => {
        if (anim.category) {
          categories[anim.category] = (categories[anim.category] || 0) + 1;
        }
      });
      allModels.forEach((model) => {
        if (model.category) {
          categories[model.category] = (categories[model.category] || 0) + 1;
        }
      });

      return {
        totalAnimations: animationCount,
        totalModels: modelCount,
        totalSize,
        oldestRecord,
        newestRecord,
        formats,
        categories,
      };
    } catch (error) {
      console.error('Failed to get database statistics:', error);
      const statsError: DatabaseError = {
        type: 'UNKNOWN',
        message: 'Failed to get database statistics',
        details: error,
      };
      throw statsError;
    }
  }

  /**
   * Get total database size
   */
  private async getTotalSize(): Promise<number> {
    try {
      const [animationSize, modelSize] = await Promise.all([
        this.getTableSize('animations'),
        this.getTableSize('models'),
      ]);

      return animationSize + modelSize;
    } catch (error) {
      console.error('Failed to get total database size:', error);
      return 0;
    }
  }

  /**
   * Get table size
   */
  private async getTableSize(tableName: string): Promise<number> {
    try {
      const table = this.db.table(tableName);
      const records = await table.toArray();
      return records.reduce((total, record) => total + (record.size || 0), 0);
    } catch (error) {
      console.error(`Failed to get size for table ${tableName}:`, error);
      return 0;
    }
  }

  /**
   * Clear all data from database
   */
  async clearAll(): Promise<void> {
    await this.initialize();

    try {
      await Promise.all([
        this.db.animations.clear(),
        this.db.models.clear(),
        this.db.thumbnails.clear(),
      ]);

      console.log('Database cleared successfully');
    } catch (error) {
      console.error('Failed to clear database:', error);
      const clearError: DatabaseError = {
        type: 'UNKNOWN',
        message: 'Failed to clear database',
        details: error,
      };
      throw clearError;
    }
  }

  /**
   * Clear specific table
   */
  async clearTable(tableName: 'animations' | 'models' | 'thumbnails' | 'preferences'): Promise<void> {
    await this.initialize();

    try {
      await this.db.table(tableName).clear();
      console.log(`Table ${tableName} cleared successfully`);
    } catch (error) {
      console.error(`Failed to clear table ${tableName}:`, error);
      const tableClearError: DatabaseError = {
        type: 'UNKNOWN',
        message: `Failed to clear table ${tableName}`,
        details: error,
      };
      throw tableClearError;
    }
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    await closeDatabase();
    this.isInitialized = false;
    this.initializationPromise = null;
  }

  /**
   * Delete database
   */
  async delete(): Promise<void> {
    await deleteDatabase();
    this.isInitialized = false;
    this.initializationPromise = null;
  }

  /**
   * Handle database error
   */
  handleError(error: unknown): DatabaseError {
    if (error && typeof error === 'object' && 'type' in error && 'message' in error) {
      return error as DatabaseError;
    }

    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      return {
        type: 'QUOTA_EXCEEDED',
        message: 'Database storage quota exceeded',
        details: error,
      };
    }

    return {
      type: 'UNKNOWN',
      message: 'An unknown database error occurred',
      details: error,
    };
  }
}

/**
 * Database service singleton
 */
let databaseServiceInstance: DatabaseService | null = null;

/**
 * Get database service instance
 */
export function getDatabaseService(): DatabaseService {
  if (!databaseServiceInstance) {
    databaseServiceInstance = new DatabaseService();
  }
  return databaseServiceInstance;
}
