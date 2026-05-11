/**
 * Metadata Extraction Constants
 */

export const EXTRACTOR_VERSION = '1.0.0';

/** Triangle thresholds — a model with fewer triangles than the value is in that bucket. */
export const POLY_BUCKETS = { low: 10_000, mid: 50_000, high: 200_000 } as const;

/** All 55 VRM-spec humanoid bone names (25 body + 15 left fingers + 15 right fingers). */
export const VRM_STANDARD_HUMANOID_BONES: readonly string[] = [
  // Core body (25): head/spine (9) + legs (8) + arms (8)
  'hips', 'spine', 'chest', 'upperChest', 'neck', 'head',
  'leftEye', 'rightEye', 'jaw',
  'leftUpperLeg', 'leftLowerLeg', 'leftFoot', 'leftToes',
  'rightUpperLeg', 'rightLowerLeg', 'rightFoot', 'rightToes',
  'leftShoulder', 'leftUpperArm', 'leftLowerArm', 'leftHand',
  'rightShoulder', 'rightUpperArm', 'rightLowerArm', 'rightHand',
  // Left fingers (15)
  'leftThumbMetacarpal', 'leftThumbProximal', 'leftThumbDistal',
  'leftIndexProximal', 'leftIndexIntermediate', 'leftIndexDistal',
  'leftMiddleProximal', 'leftMiddleIntermediate', 'leftMiddleDistal',
  'leftRingProximal', 'leftRingIntermediate', 'leftRingDistal',
  'leftLittleProximal', 'leftLittleIntermediate', 'leftLittleDistal',
  // Right fingers (15)
  'rightThumbMetacarpal', 'rightThumbProximal', 'rightThumbDistal',
  'rightIndexProximal', 'rightIndexIntermediate', 'rightIndexDistal',
  'rightMiddleProximal', 'rightMiddleIntermediate', 'rightMiddleDistal',
  'rightRingProximal', 'rightRingIntermediate', 'rightRingDistal',
  'rightLittleProximal', 'rightLittleIntermediate', 'rightLittleDistal',
] as const; // 55 bones total

/** Known VRM expression preset names (shared across 0.x and 1.0). */
export const VRM_EXPRESSION_PRESETS: readonly string[] = [
  'aa', 'ih', 'ou', 'ee', 'oh',
  'blink', 'blinkLeft', 'blinkRight',
  'lookLeft', 'lookRight', 'lookUp', 'lookDown',
  'neutral', 'surprised', 'angry', 'sad', 'happy', 'relaxed', 'unknown',
] as const;

/** MToon-specific texture property names used when enumerating textures. */
export const MTOON_TEXTURE_PROPS: readonly string[] = [
  'shadeMultiplyTexture',
  'outlineWidthMultiplyTexture',
  'rimMultiplyTexture',
  'matcapTexture',
  'uvAnimationMaskTexture',
] as const;

/** Standard Three.js material texture property names. */
export const STANDARD_TEXTURE_PROPS: readonly string[] = [
  'map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap',
  'aoMap', 'alphaMap', 'bumpMap', 'displacementMap', 'envMap', 'specularMap',
] as const;
