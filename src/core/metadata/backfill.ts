/**
 * Metadata Backfill
 *
 * Runs once on app boot to re-extract metadata for any stored ModelRecord
 * whose `extractedMetadata.extractorVersion` is out of date (or missing
 * entirely — pre-pipeline records). Idempotent and self-throttling:
 * short-circuits when localStorage records that `EXTRACTOR_VERSION` has
 * already been processed, and yields to the browser idle scheduler between
 * batches so it doesn't compete with rendering.
 *
 * Records that fail to parse (corrupt blob, stale format) are counted in
 * `failed` and the backfill is still marked complete — they would otherwise
 * cause a re-run on every boot. The next bump of EXTRACTOR_VERSION triggers
 * a fresh attempt.
 */

import * as THREE from 'three';
import { VRM } from '@pixiv/three-vrm';
import { getModelRepository } from '../database/repositories/ModelRepository';
import { vrmLoader } from '../three/loaders/VRMLoader';
import { loaderManager } from '../three/loaders/LoaderManager';
import { EXTRACTOR_VERSION } from './constants';
import { extractAllMetadata } from './MetadataPipeline';
import type { ModelRecord } from '../../types/database.types';
import type { ExtractedBundle } from '../database/services/ModelService';

const BACKFILL_KEY = 'vrm_backfill_version';
/**
 * Number of records re-parsed in parallel per batch. Each parse loads a full
 * 3D model into memory; small batch keeps memory pressure bounded on
 * mobile / low-RAM systems.
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
 * Yield to the browser idle scheduler between batches. Falls back to a
 * zero-delay macro-task in Node or when requestIdleCallback is unavailable.
 */
function yieldBetweenBatches(): Promise<void> {
  return new Promise<void>((resolve) => {
    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(() => resolve(), { timeout: 1000 });
    } else if (typeof (globalThis as Record<string, unknown>).setImmediate === 'function') {
      (globalThis as unknown as { setImmediate: (fn: () => void) => void }).setImmediate(resolve);
    } else {
      setTimeout(resolve, 0);
    }
  });
}

function isBackfillComplete(): boolean {
  try {
    return localStorage.getItem(BACKFILL_KEY) === EXTRACTOR_VERSION;
  } catch {
    return false;
  }
}

function markBackfillComplete(): void {
  try {
    localStorage.setItem(BACKFILL_KEY, EXTRACTOR_VERSION);
  } catch {
    // localStorage may be unavailable (private browsing, quota); the
    // backfill will simply re-run next session.
  }
}

function needsBackfill(record: { extractedMetadata?: { extractorVersion: string } }): boolean {
  if (!record.extractedMetadata) return true;
  return record.extractedMetadata.extractorVersion !== EXTRACTOR_VERSION;
}

/**
 * Re-load + re-extract a single record. Returns true if the update was
 * applied. Returns false on any kind of parse failure or missing blob.
 */
async function processRecord(
  repository: ReturnType<typeof getModelRepository>,
  record: ModelRecord
): Promise<boolean> {
  if (!record.data || record.data.byteLength === 0) return false;
  if (record.id === undefined) return false;

  // Re-parse the raw bytes back into a scene (+ optional VRM). For .vrm
  // we go straight to vrmLoader so the extraction pipeline has access to
  // `.vrm.expressionManager` / `.vrm.humanoid` for rig + expression info.
  // For other formats, loaderManager returns a plain THREE.Group which
  // is sufficient for geometry + material extraction; rig info is empty.
  let scene: THREE.Object3D;
  let vrm: VRM | undefined;
  let animations: THREE.AnimationClip[] = [];

  try {
    if (record.format === 'vrm') {
      const vrmResult = await vrmLoader.loadFromArrayBuffer(record.data);
      if (!vrmResult.success || !vrmResult.data) return false;
      scene = vrmResult.data.scene;
      vrm = vrmResult.data.vrm;
    } else {
      const filename = `model.${record.format}`;
      const result = await loaderManager.loadFromArrayBuffer(record.data, filename);
      if (!result.success || !result.data?.model) return false;
      scene = result.data.model;
      if (result.data.animation) animations = [result.data.animation];
    }
  } catch (err) {
    console.warn(`[backfill] failed to re-parse model ${record.uuid}:`, err);
    return false;
  }

  let bundle: ExtractedBundle;
  try {
    bundle = (await extractAllMetadata({
      scene,
      vrm,
      buffer: record.data,
      format: record.format,
      animations,
    })) as ExtractedBundle;
  } catch (err) {
    console.warn(`[backfill] extractAllMetadata threw on ${record.uuid}:`, err);
    return false;
  }

  const updateResult = await repository.update(record.id, {
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
 * Safe to call on every app boot — short-circuits when this
 * EXTRACTOR_VERSION has already completed.
 */
export async function runBackfillIfNeeded(
  onProgress?: BackfillProgressCallback
): Promise<{ processed: number; updated: number; failed: number }> {
  if (isBackfillComplete()) {
    return { processed: 0, updated: 0, failed: 0 };
  }

  const repository = getModelRepository();

  // Load every record (with blob). The backfill needs the raw bytes to
  // re-parse, so a blob-strip pass first would just defer the work — every
  // candidate becomes a candidate-for-hydration on the next pass.
  const allResult = await repository.getAll();
  if (!allResult.success || !allResult.data) {
    return { processed: 0, updated: 0, failed: 0 };
  }

  const candidates = allResult.data.filter(needsBackfill);
  const total = candidates.length;

  if (total === 0) {
    markBackfillComplete();
    return { processed: 0, updated: 0, failed: 0 };
  }

  let updated = 0;
  let failed = 0;

  for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    const batch = candidates.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map(async (record) => {
        try {
          const ok = await processRecord(repository, record);
          if (ok) updated++;
          else failed++;
        } catch (err) {
          console.warn(`[backfill] unexpected error on ${record.uuid}:`, err);
          failed++;
        }
      })
    );

    onProgress?.({
      processed: Math.min(i + BATCH_SIZE, total),
      total,
      updated,
      failed,
    });

    if (i + BATCH_SIZE < candidates.length) {
      await yieldBetweenBatches();
    }
  }

  // Mark complete unconditionally. Failed records won't be retried until
  // EXTRACTOR_VERSION changes — preventing an infinite re-run loop on
  // corrupt blobs.
  markBackfillComplete();
  if (failed > 0) {
    console.warn(
      `[backfill] Completed with ${failed}/${total} unrecoverable failures. ` +
      `These records will not be retried until EXTRACTOR_VERSION changes.`
    );
  }

  return { processed: total, updated, failed };
}
