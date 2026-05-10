/**
 * Metadata Backfill
 *
 * Runs in the background on app boot to ensure all stored ModelRecords have
 * up-to-date extractedMetadata. Models whose extractorVersion doesn't match
 * EXTRACTOR_VERSION are re-processed.
 *
 * Owned by: integration/deployment agent.
 * Imports from ml-engineer (extractAllMetadata) and data-engineer (repository)
 * may not resolve until those PRs merge — expected.
 */

import { getModelRepository } from '../database/repositories/ModelRepository';
import { EXTRACTOR_VERSION } from './constants';
import { extractAllMetadata } from './MetadataPipeline';
import { loaderManager } from '../three/loaders/LoaderManager';
import * as THREE from 'three';
import type { ModelRecord } from '../../types/database.types';
import type { ExtractedBundle } from '../database/services/ModelService';

/** LocalStorage key that records which extractor version has fully backfilled. */
const BACKFILL_KEY = 'vrm_backfill_version';
/**
 * Number of records re-parsed in parallel per batch. Each parse loads a full
 * 3D model into memory, so we keep the batch small to avoid memory spikes on
 * mobile devices and low-RAM systems.
 */
const BATCH_SIZE = 2;

export interface BackfillProgress {
  processed: number;
  total: number;
  updated: number;
  failed: number;
}

export type BackfillProgressCallback = (progress: BackfillProgress) => void;

/**
 * Yields control to the browser idle scheduler between batches.
 * Falls back to a zero-delay macro-task in Node or when
 * requestIdleCallback is unavailable.
 */
function yieldBetweenBatches(): Promise<void> {
  return new Promise<void>((resolve) => {
    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(() => resolve(), { timeout: 1000 });
    } else if (typeof (globalThis as Record<string, unknown>).setImmediate === 'function') {
      // Node.js environment (CLI usage)
      (globalThis as unknown as { setImmediate: (fn: () => void) => void }).setImmediate(resolve);
    } else {
      setTimeout(resolve, 0);
    }
  });
}

/**
 * Check whether the backfill for the current EXTRACTOR_VERSION has already
 * been completed (persisted in localStorage).
 */
function isBackfillComplete(): boolean {
  try {
    return localStorage.getItem(BACKFILL_KEY) === EXTRACTOR_VERSION;
  } catch {
    // localStorage may be unavailable in some environments.
    return false;
  }
}

/**
 * Mark the backfill for the current EXTRACTOR_VERSION as complete.
 */
function markBackfillComplete(): void {
  try {
    localStorage.setItem(BACKFILL_KEY, EXTRACTOR_VERSION);
  } catch {
    // Ignore write failures.
  }
}

/**
 * Determine whether a record needs backfilling.
 */
function needsBackfill(record: ModelRecord): boolean {
  if (!record.extractedMetadata) return true;
  return record.extractedMetadata.extractorVersion !== EXTRACTOR_VERSION;
}

/**
 * Re-extract metadata for a single record and update the repository.
 * Returns true if the update was applied.
 */
async function processRecord(
  repository: ReturnType<typeof getModelRepository>,
  id: number,
  format: string
): Promise<boolean> {
  // Fetch full record (including ArrayBuffer blob).
  // data-engineer may add a second `withBlob` param; guard for pre-merge builds.
  const repoAny = repository as unknown as {
    getById(id: number, withBlob?: boolean): Promise<{ success: boolean; data?: ModelRecord }>;
  };
  const full = await repoAny.getById(id);

  if (!full.success || !full.data) return false;

  const record = full.data;
  if (!record.data || record.data.byteLength === 0) return false;

  // Re-parse using LoaderManager.
  const filename = `model.${format}`;
  let parsed: unknown;
  let arrayBuffer: ArrayBuffer;

  try {
    const loaderResult = await loaderManager.loadFromArrayBuffer(record.data, filename);
    if (!loaderResult.success || !loaderResult.data) return false;
    parsed = loaderResult.data.parsed;
    arrayBuffer = loaderResult.data.arrayBuffer ?? record.data;
  } catch {
    return false;
  }

  // Run extraction — build PipelineArgs from the parsed loader output.
  let bundle: ExtractedBundle;
  try {
    const parsedAsRecord = parsed as Record<string, unknown> | null | undefined;
    const scene: THREE.Object3D =
      (parsedAsRecord?.scene as THREE.Object3D | undefined) ??
      new THREE.Object3D();
    const vrm = parsedAsRecord?.vrm as import('@pixiv/three-vrm').VRM | undefined;
    const animations = (parsedAsRecord?.animations as THREE.AnimationClip[] | undefined) ?? [];

    bundle = (await extractAllMetadata({
      scene,
      vrm,
      buffer: arrayBuffer,
      format,
      animations,
    })) as ExtractedBundle;
  } catch {
    return false;
  }

  // Persist the updated bundle.
  const updateResult = await repository.update(id, {
    extractedMetadata: bundle.extractedMetadata,
    normalizedLicense: bundle.normalizedLicense,
    searchTokens: bundle.searchTokens,
    sha256: bundle.sha256,
    polyBucket: bundle.extractedMetadata.geometry.polyBucket,
    isHumanoid: bundle.extractedMetadata.rig.isHumanoid,
    humanoidBones: bundle.extractedMetadata.rig.humanoidBonesPresent,
    ...(bundle.normalizedLicense.licenseName
      ? { license: bundle.normalizedLicense.licenseName }
      : {}),
  });

  return updateResult.success;
}

/**
 * Run the background backfill if needed.
 *
 * Safe to call on every app boot — it short-circuits immediately when the
 * backfill for EXTRACTOR_VERSION has already been recorded in localStorage.
 *
 * @param onProgress - Optional callback for progress reporting.
 */
export async function runBackfillIfNeeded(
  onProgress?: BackfillProgressCallback
): Promise<{ processed: number; updated: number; failed: number }> {
  if (isBackfillComplete()) {
    return { processed: 0, updated: 0, failed: 0 };
  }

  const repository = getModelRepository();

  // Fetch all summaries (blob-stripped per data-engineer's getAll change).
  const allResult = await repository.getAll();
  if (!allResult.success || !allResult.data) {
    return { processed: 0, updated: 0, failed: 0 };
  }

  const records = allResult.data.filter(needsBackfill);
  const total = records.length;

  if (total === 0) {
    markBackfillComplete();
    return { processed: 0, updated: 0, failed: 0 };
  }

  let updated = 0;
  let failed = 0;

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map(async (record) => {
        if (!record.id) { failed++; return; }
        try {
          const ok = await processRecord(repository, record.id, record.format);
          if (ok) {
            updated++;
          } else {
            failed++;
          }
        } catch {
          failed++;
        }
      })
    );

    const processed = Math.min(i + BATCH_SIZE, total);
    onProgress?.({ processed, total, updated, failed });

    if (i + BATCH_SIZE < records.length) {
      await yieldBetweenBatches();
    }
  }

  // Mark complete unconditionally after a full pass. Records that failed
  // (e.g. URL-loaded models with no stored blob, or corrupt files) will keep
  // failing on retries and would otherwise cause the backfill to re-run on
  // every boot. The failure count is logged for visibility.
  markBackfillComplete();
  if (failed > 0) {
    console.warn(
      `[backfill] Completed with ${failed}/${total} unrecoverable failures. ` +
      `These records will not be retried until EXTRACTOR_VERSION changes.`
    );
  }

  return { processed: total, updated, failed };
}
