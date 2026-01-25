/**
 * useVRM Hook
 * @deprecated Use useModel instead
 * This is a backward compatibility alias that will be removed in a future version
 */

import { useModel } from './useModel';

/**
 * @deprecated Use useModel instead - this hook now supports all formats (GLB, GLTF, VRM, FBX, etc.)
 *
 * Migration guide:
 * Before: import { useVRM } from '@/hooks/useVRM';
 * After:  import { useModel } from '@/hooks/useModel';
 *
 * The useModel hook works identically but supports all formats, not just VRM.
 */
export function useVRM() {
  return useModel();
}

// Re-export all types for backward compatibility
export type {
  Model as VRMModel,
  ModelMetadata as VRMMetadata,
  ModelFormat,
  AssetType,
  SkeletonType,
} from '../types/model.types';
