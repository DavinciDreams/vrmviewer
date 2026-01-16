/**
 * VRoid VRM blend shape names and expression presets
 */

/**
 * VRoid Studio specific blend shape names
 */
export const VRoidBlendShapeNames = {
  // Face expressions
  Blink: 'Blink',
  Blink_L: 'Blink_L',
  Blink_R: 'Blink_R',
  
  // Mouth expressions
  A: 'A',
  I: 'I',
  U: 'U',
  E: 'E',
  O: 'O',
  
  // Eye expressions
  EyeSmile: 'EyeSmile',
  EyeSmile_L: 'EyeSmile_L',
  EyeSmile_R: 'EyeSmile_R',
  
  // Eyebrows
  Angry: 'Angry',
  Fun: 'Fun',
  Sorrow: 'Sorrow',
  Upperlip: 'Upperlip',
  
  // Cheek
  Blush: 'Blush',
  
  // Face overall
  Neutral: 'Neutral',
} as const;

/**
 * VRM 1.0 preset blend shape names
 */
export const VRMPresetBlendShapeNames = {
  aa: 'aa',
  ih: 'ih',
  ou: 'ou',
  ee: 'ee',
  oh: 'oh',
  blink: 'blink',
  blinkLeft: 'blinkLeft',
  blinkRight: 'blinkRight',
  lookUp: 'lookUp',
  lookDown: 'lookDown',
  lookLeft: 'lookLeft',
  lookRight: 'lookRight',
  neutral: 'neutral',
  angry: 'angry',
  sad: 'sad',
  happy: 'happy',
  surprised: 'surprised',
  unknown: 'unknown',
} as const;

/**
 * Expression presets with blend shape combinations
 */
export const ExpressionPresets = {
  neutral: {
    name: 'Neutral',
    blendShapes: {
      blink: 0,
      blinkLeft: 0,
      blinkRight: 0,
      happy: 0,
      angry: 0,
      sad: 0,
      surprised: 0,
    },
  },
  
  joy: {
    name: 'Joy',
    blendShapes: {
      blink: 0,
      blinkLeft: 0,
      blinkRight: 0,
      happy: 1,
      angry: 0,
      sad: 0,
      surprised: 0,
    },
  },
  
  angry: {
    name: 'Angry',
    blendShapes: {
      blink: 0,
      blinkLeft: 0,
      blinkRight: 0,
      happy: 0,
      angry: 1,
      sad: 0,
      surprised: 0,
    },
  },
  
  sad: {
    name: 'Sad',
    blendShapes: {
      blink: 0.2,
      blinkLeft: 0.2,
      blinkRight: 0.2,
      happy: 0,
      angry: 0,
      sad: 1,
      surprised: 0,
    },
  },
  
  surprised: {
    name: 'Surprised',
    blendShapes: {
      blink: 0,
      blinkLeft: 0,
      blinkRight: 0,
      happy: 0,
      angry: 0,
      sad: 0,
      surprised: 1,
    },
  },
  
  blink: {
    name: 'Blink',
    blendShapes: {
      blink: 1,
      blinkLeft: 0,
      blinkRight: 0,
      happy: 0,
      angry: 0,
      sad: 0,
      surprised: 0,
    },
  },
  
  smile: {
    name: 'Smile',
    blendShapes: {
      blink: 0,
      blinkLeft: 0,
      blinkRight: 0,
      happy: 0.5,
      angry: 0,
      sad: 0,
      surprised: 0,
    },
  },
} as const;

/**
 * Lip sync blend shapes (visemes)
 */
export const LipSyncBlendShapes = {
  // Closed mouth
  silence: {
    name: 'Silence',
    blendShapes: {
      aa: 0,
      ih: 0,
      ou: 0,
      ee: 0,
      oh: 0,
    },
  },
  
  // Vowel sounds
  aa: {
    name: 'Ah',
    blendShapes: {
      aa: 1,
      ih: 0,
      ou: 0,
      ee: 0,
      oh: 0,
    },
  },
  
  ih: {
    name: 'Ee',
    blendShapes: {
      aa: 0,
      ih: 1,
      ou: 0,
      ee: 0,
      oh: 0,
    },
  },
  
  ou: {
    name: 'Oo',
    blendShapes: {
      aa: 0,
      ih: 0,
      ou: 1,
      ee: 0,
      oh: 0,
    },
  },
  
  ee: {
    name: 'Ay',
    blendShapes: {
      aa: 0,
      ih: 0,
      ou: 0,
      ee: 1,
      oh: 0,
    },
  },
  
  oh: {
    name: 'Oh',
    blendShapes: {
      aa: 0,
      ih: 0,
      ou: 0,
      ee: 0,
      oh: 1,
    },
  },
  
  // Consonant positions
  M: {
    name: 'M',
    blendShapes: {
      aa: 0,
      ih: 0,
      ou: 0.2,
      ee: 0,
      oh: 0.2,
    },
  },
  
  L: {
    name: 'L',
    blendShapes: {
      aa: 0.3,
      ih: 0,
      ou: 0,
      ee: 0,
      oh: 0.3,
    },
  },
  
  W: {
    name: 'W',
    blendShapes: {
      aa: 0,
      ih: 0,
      ou: 0.8,
      ee: 0,
      oh: 0.8,
    },
  },
} as const;

/**
 * Eye blink blend shapes
 */
export const EyeBlinkBlendShapes = {
  both: 'blink',
  left: 'blinkLeft',
  right: 'blinkRight',
} as const;

/**
 * Blend shape categories
 */
export const BlendShapeCategories = {
  expressions: ['happy', 'angry', 'sad', 'surprised', 'neutral'],
  lipsync: ['aa', 'ih', 'ou', 'ee', 'oh'],
  eyes: ['blink', 'blinkLeft', 'blinkRight', 'lookUp', 'lookDown', 'lookLeft', 'lookRight'],
} as const;

/**
 * Type definitions
 */
export type VRoidBlendShapeName = typeof VRoidBlendShapeNames[keyof typeof VRoidBlendShapeNames];
export type VRMPresetBlendShapeName = typeof VRMPresetBlendShapeNames[keyof typeof VRMPresetBlendShapeNames];
export type ExpressionPresetName = keyof typeof ExpressionPresets;
export type LipSyncVisemeName = keyof typeof LipSyncBlendShapes;
export type BlendShapeCategory = keyof typeof BlendShapeCategories;

/**
 * Blend shape value type (0-1)
 */
export type BlendShapeValue = number;

/**
 * Blend shape map type
 */
export type BlendShapeMap = Record<string, BlendShapeValue>;
