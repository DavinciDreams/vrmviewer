/**
 * Rig Extraction
 * Extracts bone count, humanoid completeness, expressions, and blend shapes from a THREE scene.
 */

import * as THREE from 'three';
import { VRM } from '@pixiv/three-vrm';
import { ExtractedModelMetadata } from '../../types/database.types';
import { VRM_STANDARD_HUMANOID_BONES, VRM_EXPRESSION_PRESETS } from './constants';

type RigResult = ExtractedModelMetadata['rig'];

const ZERO_RIG: RigResult = {
  boneCount: 0,
  isHumanoid: false,
  humanoidBonesPresent: [],
  humanoidCompleteness: 0,
  expressionCount: 0,
  expressionPresets: [],
  customExpressions: [],
  blendShapeCount: 0,
};

export function extractRig(scene: THREE.Object3D, vrm?: VRM): RigResult {
  try {
    // Count raw THREE.Bone nodes in scene
    let boneCount = 0;
    let blendShapeCount = 0;

    scene.traverse((obj) => {
      if (obj instanceof THREE.Bone) boneCount += 1;
      if (obj instanceof THREE.Mesh) {
        blendShapeCount += obj.morphTargetInfluences?.length ?? 0;
      }
    });

    if (!vrm) {
      return { ...ZERO_RIG, boneCount, blendShapeCount };
    }

    // VRM humanoid
    const isHumanoid = !!vrm.humanoid;
    let humanoidBonesPresent: string[] = [];

    if (vrm.humanoid) {
      const rawBones = vrm.humanoid.humanBones as Record<string, { node?: THREE.Object3D | null } | null | undefined>;
      humanoidBonesPresent = Object.keys(rawBones).filter((k) => {
        const entry = rawBones[k];
        return entry != null && entry.node != null;
      });
    }

    // Ratio of present-bones to the FULL VRM-spec humanoid bone set
    // (not to the bones the loader detected). A model with all major body
    // bones but no fingers will score ~0.45, not 1.0. This is intentional —
    // it lets callers filter for "rigs complete enough for finger animation".
    const humanoidCompleteness =
      VRM_STANDARD_HUMANOID_BONES.length > 0
        ? humanoidBonesPresent.length / VRM_STANDARD_HUMANOID_BONES.length
        : 0;

    // Expressions
    let expressionCount = 0;
    const expressionPresets: string[] = [];
    const customExpressions: string[] = [];

    if (vrm.expressionManager) {
      const mgr = vrm.expressionManager as unknown as {
        getExpressionNames?: () => string[];
        expressions?: Record<string, unknown>;
        _expressions?: unknown[];
      };

      let allNames: string[] = [];

      if (typeof mgr.getExpressionNames === 'function') {
        allNames = mgr.getExpressionNames();
      } else if (mgr.expressions && typeof mgr.expressions === 'object') {
        allNames = Object.keys(mgr.expressions);
      }

      expressionCount = allNames.length;

      const presetSet = new Set<string>(VRM_EXPRESSION_PRESETS);
      for (const name of allNames) {
        if (presetSet.has(name)) {
          expressionPresets.push(name);
        } else {
          customExpressions.push(name);
        }
      }
    }

    return {
      boneCount,
      isHumanoid,
      humanoidBonesPresent,
      humanoidCompleteness,
      expressionCount,
      expressionPresets,
      customExpressions,
      blendShapeCount,
    };
  } catch {
    return { ...ZERO_RIG };
  }
}
