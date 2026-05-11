/**
 * Material Extraction
 * Extracts material counts, types, texture stats, and transparency from a THREE scene.
 * Async to allow a one-time lazy import of MToonMaterial from @pixiv/three-vrm.
 */

import * as THREE from 'three';
import { ExtractedModelMetadata } from '../../types/database.types';
import { STANDARD_TEXTURE_PROPS, MTOON_TEXTURE_PROPS } from './constants';

type MaterialsResult = ExtractedModelMetadata['materials'];

// Module-level MToon class cache — imported once on first call.
let mtoonClassCache: (new (...args: unknown[]) => object) | null | undefined = undefined;

async function getMToonClass(): Promise<(new (...args: unknown[]) => object) | null> {
  if (mtoonClassCache !== undefined) return mtoonClassCache;
  try {
    const mod = await import('@pixiv/three-vrm');
    const cls = (mod as unknown as Record<string, unknown>)['MToonMaterial'];
    mtoonClassCache = (typeof cls === 'function'
      ? cls
      : null) as (new (...args: unknown[]) => object) | null;
  } catch {
    mtoonClassCache = null;
  }
  return mtoonClassCache;
}

interface ImageLike {
  width?: number;
  height?: number;
}

function getTextureBytes(texture: THREE.Texture): number {
  const image = texture.image as ImageLike | null | undefined;
  if (!image) return 0;
  const w = image.width ?? 0;
  const h = image.height ?? 0;
  return w * h * 4; // RGBA bytes estimate
}

function getTextureResolution(texture: THREE.Texture): [number, number] {
  const image = texture.image as ImageLike | null | undefined;
  if (!image) return [0, 0];
  return [image.width ?? 0, image.height ?? 0];
}

const ZERO_MATERIALS: MaterialsResult = {
  materialCount: 0,
  textureCount: 0,
  totalTextureBytes: 0,
  materialTypes: { mtoon: 0, pbr: 0, basic: 0, other: 0 },
  hasTransparency: false,
  largestTextureResolution: [0, 0],
};

export async function extractMaterials(scene: THREE.Object3D): Promise<MaterialsResult> {
  try {
    const MToonClass = await getMToonClass();

    const materialSet = new Set<string>(); // keyed by UUID
    const materials: THREE.Material[] = [];

    scene.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const mat of mats) {
        if (mat && !materialSet.has(mat.uuid)) {
          materialSet.add(mat.uuid);
          materials.push(mat);
        }
      }
    });

    const counts = { mtoon: 0, pbr: 0, basic: 0, other: 0 };
    let hasTransparency = false;

    for (const mat of materials) {
      if (MToonClass && mat instanceof MToonClass) {
        counts.mtoon += 1;
      } else if (mat instanceof THREE.MeshStandardMaterial || mat instanceof THREE.MeshPhysicalMaterial) {
        counts.pbr += 1;
      } else if (
        mat instanceof THREE.MeshBasicMaterial ||
        mat instanceof THREE.MeshLambertMaterial ||
        mat instanceof THREE.MeshPhongMaterial
      ) {
        counts.basic += 1;
      } else {
        counts.other += 1;
      }

      if (mat.transparent || (mat as THREE.MeshBasicMaterial).alphaTest > 0 || mat.opacity < 1) {
        hasTransparency = true;
      }
    }

    // Collect unique textures
    const textureSet = new Set<string>(); // keyed by texture UUID
    const textures: THREE.Texture[] = [];

    const allProps = [...STANDARD_TEXTURE_PROPS, ...MTOON_TEXTURE_PROPS];

    for (const mat of materials) {
      const matAsRecord = mat as unknown as Record<string, unknown>;
      for (const prop of allProps) {
        const val = matAsRecord[prop];
        if (val instanceof THREE.Texture && !textureSet.has(val.uuid)) {
          textureSet.add(val.uuid);
          textures.push(val);
        }
      }
    }

    let totalTextureBytes = 0;
    let largestTextureResolution: [number, number] = [0, 0];

    for (const tex of textures) {
      const bytes = getTextureBytes(tex);
      totalTextureBytes += bytes;
      const [w, h] = getTextureResolution(tex);
      if (w * h > largestTextureResolution[0] * largestTextureResolution[1]) {
        largestTextureResolution = [w, h];
      }
    }

    return {
      materialCount: materials.length,
      textureCount: textures.length,
      totalTextureBytes,
      materialTypes: counts,
      hasTransparency,
      largestTextureResolution,
    };
  } catch {
    return { ...ZERO_MATERIALS, materialTypes: { mtoon: 0, pbr: 0, basic: 0, other: 0 } };
  }
}
