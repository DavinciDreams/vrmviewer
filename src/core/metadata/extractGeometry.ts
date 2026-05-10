/**
 * Geometry Extraction
 * Extracts triangle/vertex counts, bounding box, height, and poly-bucket from a THREE scene.
 */

import * as THREE from 'three';
import { ExtractedModelMetadata } from '../../types/database.types';
import { POLY_BUCKETS } from './constants';

type GeometryResult = ExtractedModelMetadata['geometry'];

function classifyPolyBucket(triangleCount: number): GeometryResult['polyBucket'] {
  if (triangleCount < POLY_BUCKETS.low) return 'low';
  if (triangleCount < POLY_BUCKETS.mid) return 'mid';
  if (triangleCount < POLY_BUCKETS.high) return 'high';
  return 'ultra';
}

const ZERO_RESULT: GeometryResult = {
  triangleCount: 0,
  vertexCount: 0,
  meshCount: 0,
  boundingBox: { min: [0, 0, 0], max: [0, 0, 0] },
  height: 0,
  polyBucket: 'low',
};

export function extractGeometry(scene: THREE.Object3D): GeometryResult {
  try {
    let triangleCount = 0;
    let vertexCount = 0;
    let meshCount = 0;

    scene.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      const geo = obj.geometry as THREE.BufferGeometry | undefined;
      if (!geo) return;

      meshCount += 1;

      const posAttr = geo.attributes['position'];
      if (!posAttr) return;

      const verts = posAttr.count;
      vertexCount += verts;

      // Assumes TrianglesDrawMode (the THREE default). Overestimates for the
      // rarely-used TriangleStripDrawMode/TriangleFanDrawMode cases — VRM
      // models always use plain triangles so this is acceptable in practice.
      if (geo.index) {
        triangleCount += Math.floor(geo.index.count / 3);
      } else {
        triangleCount += Math.floor(verts / 3);
      }
    });

    if (meshCount === 0) {
      return { ...ZERO_RESULT };
    }

    const box = new THREE.Box3().setFromObject(scene);

    // Guard against empty / NaN bounding boxes (e.g. geometry with no positions)
    const minX = isFinite(box.min.x) ? box.min.x : 0;
    const minY = isFinite(box.min.y) ? box.min.y : 0;
    const minZ = isFinite(box.min.z) ? box.min.z : 0;
    const maxX = isFinite(box.max.x) ? box.max.x : 0;
    const maxY = isFinite(box.max.y) ? box.max.y : 0;
    const maxZ = isFinite(box.max.z) ? box.max.z : 0;

    const height = maxY - minY;

    return {
      triangleCount,
      vertexCount,
      meshCount,
      boundingBox: {
        min: [minX, minY, minZ],
        max: [maxX, maxY, maxZ],
      },
      height,
      polyBucket: classifyPolyBucket(triangleCount),
    };
  } catch {
    return { ...ZERO_RESULT };
  }
}
