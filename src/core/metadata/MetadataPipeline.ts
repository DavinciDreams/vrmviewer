/**
 * Metadata Pipeline Orchestrator
 * Runs all individual extraction functions and bundles results into a single object
 * ready for the integration agent to spread onto a ModelRecord.
 * Each extractor is wrapped in try/catch — a single failure never aborts the pipeline.
 */

import * as THREE from 'three';
import { VRM } from '@pixiv/three-vrm';
import { ExtractedModelMetadata, NormalizedLicense } from '../../types/database.types';
import { EXTRACTOR_VERSION } from './constants';
import { extractGeometry } from './extractGeometry';
import { extractRig } from './extractRig';
import { extractMaterials } from './extractMaterials';
import { sha256, pHash } from './extractHashes';
import { normalizeLicense } from './normalizeLicense';
import { tokenize } from './tokenize';

export interface PipelineArgs {
  scene: THREE.Object3D;
  vrm?: VRM;
  buffer: ArrayBuffer;
  format: string;
  thumbnailDataUrl?: string;
  animations?: THREE.AnimationClip[];
}

export interface PipelineResult {
  extractedMetadata: ExtractedModelMetadata;
  normalizedLicense: NormalizedLicense;
  searchTokens: string[];
  sha256: string;
}

const ZERO_GEOMETRY: ExtractedModelMetadata['geometry'] = {
  triangleCount: 0,
  vertexCount: 0,
  meshCount: 0,
  boundingBox: { min: [0, 0, 0], max: [0, 0, 0] },
  height: 0,
  polyBucket: 'low',
};

const ZERO_RIG: ExtractedModelMetadata['rig'] = {
  boneCount: 0,
  isHumanoid: false,
  humanoidBonesPresent: [],
  humanoidCompleteness: 0,
  expressionCount: 0,
  expressionPresets: [],
  customExpressions: [],
  blendShapeCount: 0,
};

const ZERO_MATERIALS: ExtractedModelMetadata['materials'] = {
  materialCount: 0,
  textureCount: 0,
  totalTextureBytes: 0,
  materialTypes: { mtoon: 0, pbr: 0, basic: 0, other: 0 },
  hasTransparency: false,
  largestTextureResolution: [0, 0],
};

async function safeExtract<T>(fn: () => T | Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

export async function extractAllMetadata(args: PipelineArgs): Promise<PipelineResult> {
  const { scene, vrm, buffer, format, thumbnailDataUrl, animations } = args;

  // Run independent extractions concurrently; each is individually guarded.
  const [geometry, rig, materials, hashValue, perceptualHash] = await Promise.all([
    safeExtract(() => extractGeometry(scene), ZERO_GEOMETRY),
    safeExtract(() => extractRig(scene, vrm), ZERO_RIG),
    safeExtract(() => extractMaterials(scene), ZERO_MATERIALS),
    safeExtract(() => sha256(buffer), ''),
    safeExtract(
      () => (thumbnailDataUrl ? pHash(thumbnailDataUrl) : Promise.resolve(undefined)),
      undefined as string | undefined
    ),
  ]);

  const license = await safeExtract(() => normalizeLicense(vrm, format), {} as NormalizedLicense);

  // Detect VRM version for sourceFormat.
  // For non-VRM formats (GLB/FBX/GLTF) we have no spec version — emit 'n/a'
  // rather than incorrectly labelling them as a VRM version.
  const vrmMeta = vrm?.meta as unknown as Record<string, unknown> | undefined;
  const detectedVersion = !vrmMeta
    ? 'n/a'
    : 'specVersion' in vrmMeta
      ? String(vrmMeta['specVersion'])
      : '0.0';

  const animCount = animations?.length ?? 0;

  const extractedMetadata: ExtractedModelMetadata = {
    schemaVersion: 1,
    extractedAt: new Date(),
    extractorVersion: EXTRACTOR_VERSION,
    geometry,
    rig,
    materials,
    hashes: {
      sha256: hashValue,
      ...(perceptualHash !== undefined ? { pHash: perceptualHash } : {}),
    },
    sourceFormat: {
      format,
      version: detectedVersion,
      hasAnimations: animCount > 0,
      animationCount: animCount,
    },
  };

  // Build search tokens from whatever the caller will eventually persist.
  // The integration agent is responsible for passing name/author/tags;
  // we derive tokens from the VRM meta where available as a best-effort default.
  const metaAny = vrmMeta ?? {};
  const searchTokens = tokenize({
    name: (metaAny['name'] ?? metaAny['title']) as string | undefined,
    author: metaAny['author'] as string | undefined,
    license: license.licenseName ?? license.licenseUrl,
  });

  return {
    extractedMetadata,
    normalizedLicense: license,
    searchTokens,
    sha256: hashValue,
  };
}
