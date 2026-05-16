import {
  DatabaseOperationResult,
  DatabaseQueryOptions,
  DatabaseQueryResult,
  ModelRecord,
} from '../../../types/database.types';
import { ExtractedBundle, SaveModelResult } from './ModelService';

type RemoteModelRecord = Omit<ModelRecord, 'data' | 'createdAt' | 'updatedAt'> & {
  createdAt: string;
  updatedAt: string;
  data?: undefined;
  dataBase64?: string;
};

export type RemoteModelSummaryQuery = DatabaseQueryOptions & {
  assetKind?: 'all' | 'models' | 'textures';
  listing?: 'all' | 'live' | 'draft' | 'failed' | 'unlisted';
  packSlug?: string;
  sort?: 'name' | 'recent' | 'oldest' | 'size' | 'listed' | 'unlisted';
};

export type RemoteModelSummaryResult = DatabaseOperationResult<(Omit<ModelRecord, 'data'> & { data?: undefined })[]> & {
  meta?: {
    total: number;
    offset: number;
    limit: number;
    hasMore: boolean;
  };
};

function getApiBaseUrl(): string {
  return (import.meta.env.VITE_ASSET_LIBRARY_API_URL as string | undefined)?.replace(/\/$/, '') ?? '/api';
}

async function arrayBufferToBase64(buffer: ArrayBuffer): Promise<string> {
  const blob = new Blob([buffer]);
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? '');
      resolve(result.includes(',') ? result.split(',')[1] : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function normalizeRecord(record: RemoteModelRecord): ModelRecord {
  return {
    ...record,
    createdAt: new Date(record.createdAt),
    updatedAt: new Date(record.updatedAt),
    data: record.dataBase64 ? base64ToArrayBuffer(record.dataBase64) : new ArrayBuffer(0),
  };
}

function normalizeSummary(record: RemoteModelRecord): Omit<ModelRecord, 'data'> & { data?: undefined } {
  const { dataBase64: _dataBase64, data: _data, ...rest } = record;
  void _dataBase64;
  void _data;
  return {
    ...rest,
    createdAt: new Date(record.createdAt),
    updatedAt: new Date(record.updatedAt),
    data: undefined,
  };
}

function errorResult<T>(message: string, details?: unknown): DatabaseOperationResult<T> {
  return {
    success: false,
    error: {
      type: 'UNKNOWN',
      message,
      details,
    },
  };
}

async function readJsonResponse<T>(response: Response): Promise<T> {
  const value = await response.json();
  if (!response.ok || value?.success === false) {
    throw new Error(value?.error?.message ?? `HTTP ${response.status}`);
  }
  return value as T;
}

export class RemoteModelService {
  private baseUrl = getApiBaseUrl();
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    const response = await fetch(`${this.baseUrl}/health`);
    await readJsonResponse(response);
    this.initialized = true;
  }

  async saveModel(
    model: Omit<ModelRecord, 'id' | 'uuid' | 'createdAt' | 'updatedAt'>,
    _thumbnail?: string,
    extractedBundle?: ExtractedBundle,
    skipDedup = false,
  ): Promise<SaveModelResult> {
    try {
      await this.initialize();
      const dataBase64 = await arrayBufferToBase64(model.data);
      const payload = {
        ...model,
        ...(extractedBundle
          ? {
              sha256: extractedBundle.sha256,
              searchTokens: extractedBundle.searchTokens,
              polyBucket: extractedBundle.extractedMetadata.geometry.polyBucket,
              isHumanoid: extractedBundle.extractedMetadata.rig.isHumanoid,
              humanoidBones: extractedBundle.extractedMetadata.rig.humanoidBonesPresent,
              extractedMetadata: extractedBundle.extractedMetadata,
              normalizedLicense: extractedBundle.normalizedLicense,
              license: model.license ?? extractedBundle.normalizedLicense.licenseName,
            }
          : {}),
        data: undefined,
        dataBase64,
        skipDedup,
      };

      const response = await fetch(`${this.baseUrl}/models`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const value = await readJsonResponse<{ success: true; data: RemoteModelRecord; wasDeduped?: boolean }>(response);
      return {
        success: true,
        data: normalizeRecord(value.data),
        wasDeduped: value.wasDeduped,
      };
    } catch (error) {
      return errorResult('Failed to save model to server library', error);
    }
  }

  async loadModel(uuid: string): Promise<DatabaseOperationResult<ModelRecord>> {
    try {
      await this.initialize();
      const response = await fetch(`${this.baseUrl}/models/${encodeURIComponent(uuid)}`);
      const value = await readJsonResponse<{ success: true; data: RemoteModelRecord }>(response);
      return { success: true, data: normalizeRecord(value.data) };
    } catch (error) {
      return errorResult(`Failed to load model ${uuid} from server library`, error);
    }
  }

  async loadModelById(_id: number): Promise<DatabaseOperationResult<ModelRecord>> {
    return errorResult('Server-backed model library does not support numeric IDs');
  }

  async getAllModels(): Promise<DatabaseOperationResult<ModelRecord[]>> {
    const summaries = await this.listModelSummaries();
    if (!summaries.success || !summaries.data) {
      return {
        success: false,
        error: summaries.error,
      };
    }
    return {
      success: true,
      data: summaries.data.map((summary) => ({ ...summary, data: new ArrayBuffer(0) })),
    };
  }

  async listModelSummaries(query?: RemoteModelSummaryQuery): Promise<RemoteModelSummaryResult> {
    try {
      await this.initialize();
      const params = new URLSearchParams();
      if (query?.limit) params.set('limit', String(query.limit));
      if (query?.offset) params.set('offset', String(query.offset));
      if (query?.search) params.set('search', query.search);
      if (query?.format) params.set('format', query.format);
      if (query?.category) params.set('category', query.category);
      if (query?.assetKind) params.set('assetKind', query.assetKind);
      if (query?.listing) params.set('listing', query.listing);
      if (query?.packSlug) params.set('packSlug', query.packSlug);
      if (query?.sort) params.set('sort', query.sort);
      const suffix = params.size ? `?${params.toString()}` : '';
      const response = await fetch(`${this.baseUrl}/models${suffix}`);
      const value = await readJsonResponse<{
        success: true;
        data: RemoteModelRecord[];
        meta?: RemoteModelSummaryResult['meta'];
      }>(response);
      return { success: true, data: value.data.map(normalizeSummary), meta: value.meta };
    } catch (error) {
      return errorResult('Failed to list server model library', error);
    }
  }

  async updateModel(uuid: string, updates: Partial<ModelRecord>): Promise<DatabaseOperationResult<ModelRecord>> {
    try {
      await this.initialize();
      const { data: _data, ...safeUpdates } = updates;
      void _data;
      const response = await fetch(`${this.baseUrl}/models/${encodeURIComponent(uuid)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(safeUpdates),
      });
      const value = await readJsonResponse<{ success: true; data: RemoteModelRecord }>(response);
      return { success: true, data: normalizeRecord(value.data) };
    } catch (error) {
      return errorResult(`Failed to update model ${uuid} in server library`, error);
    }
  }

  async deleteModel(uuid: string): Promise<DatabaseOperationResult<void>> {
    try {
      await this.initialize();
      const response = await fetch(`${this.baseUrl}/models/${encodeURIComponent(uuid)}`, { method: 'DELETE' });
      await readJsonResponse(response);
      return { success: true };
    } catch (error) {
      return errorResult(`Failed to delete model ${uuid} from server library`, error);
    }
  }

  async bulkDeleteModels(uuids: string[]): Promise<DatabaseOperationResult<void>> {
    try {
      await this.initialize();
      const response = await fetch(`${this.baseUrl}/models:bulk-delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uuids }),
      });
      await readJsonResponse(response);
      return { success: true };
    } catch (error) {
      return errorResult('Failed to bulk delete server models', error);
    }
  }

  async clearAllModels(): Promise<DatabaseOperationResult<void>> {
    try {
      await this.initialize();
      const response = await fetch(`${this.baseUrl}/models:clear`, { method: 'POST' });
      await readJsonResponse(response);
      return { success: true };
    } catch (error) {
      return errorResult('Failed to clear server models', error);
    }
  }

  async filterModels(options: DatabaseQueryOptions): Promise<DatabaseQueryResult<ModelRecord>> {
    const result = await this.getAllModels();
    const data = result.success && result.data ? result.data : [];
    const search = options.search?.toLowerCase();
    const filtered = data.filter((model) => {
      if (search) {
        const haystack = [model.name, model.displayName, model.description, ...(model.tags ?? [])]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      if (options.category && model.category !== options.category) return false;
      if (options.format && model.format !== options.format) return false;
      if (options.polyBucket && model.polyBucket !== options.polyBucket) return false;
      if (options.isHumanoid !== undefined && model.isHumanoid !== options.isHumanoid) return false;
      if (options.license && model.license !== options.license) return false;
      return true;
    });

    return {
      data: filtered,
      total: filtered.length,
      hasMore: false,
    };
  }

  async searchModels(query: string): Promise<DatabaseOperationResult<ModelRecord[]>> {
    const result = await this.filterModels({ search: query });
    return { success: true, data: result.data };
  }

  async getModelCount(): Promise<number> {
    const result = await this.listModelSummaries();
    return result.success && result.data ? result.data.length : 0;
  }

  async getUniqueCategories(): Promise<string[]> {
    const result = await this.listModelSummaries();
    return Array.from(new Set((result.data ?? []).map((model) => model.category).filter(Boolean) as string[])).sort();
  }

  async getUniqueTags(): Promise<string[]> {
    const result = await this.listModelSummaries();
    return Array.from(new Set((result.data ?? []).flatMap((model) => model.tags ?? []))).sort();
  }

  async getRecentModels(limit = 10): Promise<DatabaseOperationResult<ModelRecord[]>> {
    const result = await this.getAllModels();
    if (!result.success || !result.data) return result;
    return { success: true, data: result.data.slice(0, limit) };
  }

  async modelExists(name: string): Promise<boolean> {
    const result = await this.listModelSummaries();
    return (result.data ?? []).some((model) => model.name === name);
  }
}

let remoteModelServiceInstance: RemoteModelService | null = null;

export function getRemoteModelService(): RemoteModelService {
  if (!remoteModelServiceInstance) {
    remoteModelServiceInstance = new RemoteModelService();
  }
  return remoteModelServiceInstance;
}
