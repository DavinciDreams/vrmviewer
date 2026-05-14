/**
 * useDatabase — focused coverage of the init flow + the guard contract +
 * a representative spot-check of each delegation grouping.
 *
 * The hook is mostly thin delegation onto three singleton services
 * (ModelService, AnimationService, DatabaseService) which already have
 * their own coverage. Testing every passthrough method would be a lot of
 * code for little signal. What this file does cover:
 *   - The init effect: services attach + isInitialized flips true
 *   - The "service not initialized" guard: returns the documented error
 *     shape before init completes
 *   - One method from each grouping (`animations.*` / `models.*` /
 *     `statistics` / `clearAll`) — enough to detect a wiring regression
 *   - `models.save`'s special 4-arg signature (model, thumbnail,
 *     extractedBundle, skipDedup) since that landed in #28
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Module mocks (hoisted)
// ---------------------------------------------------------------------------

const stubs = vi.hoisted(() => {
  const make = () => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    // ModelService surface — only the methods useDatabase touches.
    saveModel: vi.fn().mockResolvedValue({ success: true, data: { uuid: 'm1' } }),
    loadModel: vi.fn().mockResolvedValue({ success: true, data: { uuid: 'm1' } }),
    loadModelById: vi.fn().mockResolvedValue({ success: true }),
    deleteModel: vi.fn().mockResolvedValue({ success: true }),
    updateModel: vi.fn().mockResolvedValue({ success: true }),
    searchModels: vi.fn().mockResolvedValue({ success: true, data: [] }),
    filterModels: vi.fn().mockResolvedValue({ data: [], total: 0, hasMore: false }),
    getAllModels: vi.fn().mockResolvedValue({ success: true, data: [] }),
    listModelSummaries: vi.fn().mockResolvedValue({ success: true, data: [] }),
    getModelCount: vi.fn().mockResolvedValue(0),
    getUniqueCategories: vi.fn().mockResolvedValue([]),
    getUniqueTags: vi.fn().mockResolvedValue([]),
    getRecentModels: vi.fn().mockResolvedValue({ success: true, data: [] }),
    modelExists: vi.fn().mockResolvedValue(false),
    bulkDeleteModels: vi.fn().mockResolvedValue({ success: true }),
    clearAllModels: vi.fn().mockResolvedValue({ success: true }),

    // AnimationService surface.
    saveAnimation: vi.fn().mockResolvedValue({ success: true }),
    loadAnimation: vi.fn().mockResolvedValue({ success: true }),
    loadAnimationById: vi.fn().mockResolvedValue({ success: true }),
    deleteAnimation: vi.fn().mockResolvedValue({ success: true }),
    updateAnimation: vi.fn().mockResolvedValue({ success: true }),
    searchAnimations: vi.fn().mockResolvedValue({ success: true, data: [] }),
    filterAnimations: vi.fn().mockResolvedValue({ data: [], total: 0, hasMore: false }),
    getAllAnimations: vi.fn().mockResolvedValue({ success: true, data: [] }),
    getAnimationCount: vi.fn().mockResolvedValue(0),
    getRecentAnimations: vi.fn().mockResolvedValue({ success: true, data: [] }),
    animationExists: vi.fn().mockResolvedValue(false),
    bulkDeleteAnimations: vi.fn().mockResolvedValue({ success: true }),
    clearAllAnimations: vi.fn().mockResolvedValue({ success: true }),
  });

  const modelStub = make();
  const animStub = make();
  const dbStub = {
    initialize: vi.fn().mockResolvedValue(undefined),
    getStatistics: vi.fn().mockResolvedValue({
      totalModels: 0,
      totalAnimations: 0,
      totalSize: 0,
      formats: {},
      categories: {},
    }),
    clearAll: vi.fn().mockResolvedValue(undefined),
  };

  return { modelStub, animStub, dbStub };
});

vi.mock('../core/database/services/ModelService', () => ({
  getModelService: () => stubs.modelStub,
}));
vi.mock('../core/database/services/AnimationService', () => ({
  getAnimationService: () => stubs.animStub,
}));
vi.mock('../core/database/DatabaseService', () => ({
  getDatabaseService: () => stubs.dbStub,
}));

// Imports after mocks.
import { useDatabase } from './useDatabase';

beforeEach(() => {
  // Reset every mock call history; default resolved values are re-set inline
  // where the existing default doesn't apply.
  for (const fn of Object.values(stubs.modelStub)) {
    (fn as any).mockClear();
  }
  for (const fn of Object.values(stubs.animStub)) {
    (fn as any).mockClear();
  }
  stubs.dbStub.initialize.mockClear();
  stubs.dbStub.getStatistics.mockClear();
  stubs.dbStub.clearAll.mockClear();
});

// ---------------------------------------------------------------------------
// init flow
// ---------------------------------------------------------------------------

describe('useDatabase — initialization', () => {
  it('calls initialize on all three services and flips isInitialized', async () => {
    const { result } = renderHook(() => useDatabase());

    expect(result.current.isInitialized).toBe(false);

    await waitFor(() => {
      expect(result.current.isInitialized).toBe(true);
    });

    expect(stubs.dbStub.initialize).toHaveBeenCalledTimes(1);
    expect(stubs.modelStub.initialize).toHaveBeenCalled();
    expect(stubs.animStub.initialize).toHaveBeenCalled();
  });

  it('keeps isInitialized false when init throws (and logs)', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    stubs.dbStub.initialize.mockRejectedValueOnce(new Error('init failed'));

    const { result } = renderHook(() => useDatabase());

    // Yield to let the rejection propagate through the effect.
    await new Promise((r) => setTimeout(r, 10));

    expect(result.current.isInitialized).toBe(false);
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// not-initialized guard
// ---------------------------------------------------------------------------

describe('useDatabase — guards before init resolves', () => {
  it('returns the documented error shape from animations.getAll when service not attached', async () => {
    // Hold init pending so the closure captures animationService = null.
    stubs.dbStub.initialize.mockReturnValueOnce(new Promise(() => {}));

    const { result } = renderHook(() => useDatabase());
    // Return type is a union; the guard branch lives in the `{ success: false, error }`
    // member which TS can't narrow without runtime-discrimination. Cast for assertions.
    const out = (await result.current.animations.getAll()) as {
      success: boolean;
      error: { type: string; message: string };
    };

    expect(out.success).toBe(false);
    expect(out.error.type).toBe('UNKNOWN');
    expect(out.error.message).toMatch(/not initialized/i);
  });

  it('returns the documented error shape from models.getAll when service not attached', async () => {
    stubs.dbStub.initialize.mockReturnValueOnce(new Promise(() => {}));

    const { result } = renderHook(() => useDatabase());
    const out = (await result.current.models.getAll()) as {
      success: boolean;
      error: { message: string };
    };

    expect(out.success).toBe(false);
    expect(out.error.message).toMatch(/not initialized/i);
  });
});

// ---------------------------------------------------------------------------
// delegation spot-checks (post-init)
// ---------------------------------------------------------------------------

describe('useDatabase — delegation (post-init)', () => {
  async function readyHook() {
    const hook = renderHook(() => useDatabase());
    await waitFor(() => {
      expect(hook.result.current.isInitialized).toBe(true);
    });
    return hook;
  }

  // animations.* — one method to verify the grouping is wired.

  it('animations.save forwards to AnimationService.saveAnimation', async () => {
    const { result } = await readyHook();
    const record = {
      name: 'walk',
      displayName: 'Walk',
      tags: [],
      format: 'bvh' as const,
      duration: 2,
      data: new ArrayBuffer(0),
      size: 0,
    };
    await act(async () => {
      await result.current.animations.save(record);
    });
    expect(stubs.animStub.saveAnimation).toHaveBeenCalledWith(record, undefined);
  });

  it('animations.search forwards to AnimationService.searchAnimations', async () => {
    const { result } = await readyHook();
    await act(async () => {
      await result.current.animations.search('idle');
    });
    expect(stubs.animStub.searchAnimations).toHaveBeenCalledWith('idle');
  });

  // models.* — multiple methods including the new ones.

  it('models.getAllSummaries forwards to ModelService.listModelSummaries', async () => {
    const { result } = await readyHook();
    await act(async () => {
      await result.current.models.getAllSummaries();
    });
    expect(stubs.modelStub.listModelSummaries).toHaveBeenCalled();
  });

  it('models.save forwards all four args: model, thumbnail, extractedBundle, skipDedup', async () => {
    const { result } = await readyHook();
    const record = {
      name: 'M',
      displayName: 'M',
      tags: [],
      format: 'vrm' as const,
      version: '1.0' as const,
      data: new ArrayBuffer(0),
      size: 0,
    };
    const bundle = {
      sha256: 'h',
      searchTokens: [],
      normalizedLicense: { licenseName: 'CC0' },
      extractedMetadata: {} as any,
    };
    await act(async () => {
      await result.current.models.save(record, 'thumb-data', bundle, true);
    });
    expect(stubs.modelStub.saveModel).toHaveBeenCalledWith(
      record,
      'thumb-data',
      bundle,
      true,
    );
  });

  it('models.save defaults skipDedup to false when omitted', async () => {
    const { result } = await readyHook();
    const record = {
      name: 'M',
      displayName: 'M',
      tags: [],
      format: 'vrm' as const,
      version: '1.0' as const,
      data: new ArrayBuffer(0),
      size: 0,
    };
    await act(async () => {
      await result.current.models.save(record);
    });
    expect(stubs.modelStub.saveModel).toHaveBeenCalledWith(
      record,
      undefined,
      undefined,
      false,
    );
  });

  it('models.filter forwards options to ModelService.filterModels', async () => {
    const { result } = await readyHook();
    const opts = { polyBucket: 'mid' as const, hasCommercialUse: true };
    await act(async () => {
      await result.current.models.filter(opts);
    });
    expect(stubs.modelStub.filterModels).toHaveBeenCalledWith(opts);
  });

  it('models.getAll forwards options through ModelService.filterModels when options provided', async () => {
    const { result } = await readyHook();
    await act(async () => {
      await result.current.models.getAll({ format: 'vrm' });
    });
    // When options ARE provided, useDatabase routes through filter, not getAll.
    expect(stubs.modelStub.filterModels).toHaveBeenCalledWith({ format: 'vrm' });
  });

  it('models.getAll uses ModelService.getAllModels when no options provided', async () => {
    const { result } = await readyHook();
    await act(async () => {
      await result.current.models.getAll();
    });
    expect(stubs.modelStub.getAllModels).toHaveBeenCalled();
  });

  // statistics + clearAll

  it('statistics.get forwards to DatabaseService.getStatistics', async () => {
    const { result } = await readyHook();
    await act(async () => {
      await result.current.statistics.get();
    });
    expect(stubs.dbStub.getStatistics).toHaveBeenCalled();
  });

  it('clearAll forwards to DatabaseService.clearAll', async () => {
    const { result } = await readyHook();
    await act(async () => {
      await result.current.clearAll();
    });
    expect(stubs.dbStub.clearAll).toHaveBeenCalled();
  });
});
