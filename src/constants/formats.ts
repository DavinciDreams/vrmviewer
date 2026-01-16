/**
 * File Format Constants
 * Defines supported file formats, extensions, and MIME types
 */

import { ModelFormat, ModelFileType } from '../types/vrm.types';
import { AnimationFormat } from '../types/animation.types';

/**
 * Supported Model File Extensions
 */
export const MODEL_EXTENSIONS: Record<ModelFormat, string[]> = {
  vrm: ['.vrm'],
  gltf: ['.gltf'],
  glb: ['.glb'],
  fbx: ['.fbx'],
  bvh: ['.bvh'],
  vrma: ['.vrma'],
};

/**
 * Supported Animation File Extensions
 */
export const ANIMATION_EXTENSIONS: Record<AnimationFormat, string[]> = {
  bvh: ['.bvh'],
  vrma: ['.vrma'],
  gltf: ['.gltf'],
  fbx: ['.fbx'],
};

/**
 * MIME Types
 */
export const MIME_TYPES: Record<string, string> = {
  vrm: 'model/vnd.vrm',
  gltf: 'model/gltf+json',
  glb: 'model/gltf-binary',
  fbx: 'application/octet-stream',
  bvh: 'text/plain',
  vrma: 'application/octet-stream',
  json: 'application/json',
};

/**
 * File Type Detection Patterns
 */
export const FILE_SIGNATURES: Record<string, Uint8Array> = {
  glb: new Uint8Array([0x67, 0x6c, 0x54, 0x46]), // 'glTF'
  fbx: new Uint8Array([0x4b, 0x61, 0x79, 0x64, 0x61, 0x72, 0x61]), // 'Kaydara'
};

/**
 * File Size Limits (in bytes)
 */
export const FILE_SIZE_LIMITS: Record<string, number> = {
  vrm: 100 * 1024 * 1024, // 100 MB
  gltf: 100 * 1024 * 1024, // 100 MB
  glb: 100 * 1024 * 1024, // 100 MB
  fbx: 200 * 1024 * 1024, // 200 MB
  bvh: 50 * 1024 * 1024, // 50 MB
  vrma: 50 * 1024 * 1024, // 50 MB
};

/**
 * Default File Categories
 */
export const FILE_CATEGORIES: Record<string, string> = {
  vrm: 'VRM Model',
  gltf: 'GLTF Model',
  glb: 'GLB Model',
  fbx: 'FBX Model',
  bvh: 'BVH Animation',
  vrma: 'VRMA Animation',
};

/**
 * Format Display Names
 */
export const FORMAT_DISPLAY_NAMES: Record<ModelFormat | AnimationFormat, string> = {
  vrm: 'VRM',
  gltf: 'glTF',
  glb: 'glTF Binary',
  fbx: 'FBX',
  bvh: 'BVH',
  vrma: 'VRMA',
};

/**
 * Supported File Extensions (All)
 */
export const ALL_SUPPORTED_EXTENSIONS: string[] = [
  ...MODEL_EXTENSIONS.vrm,
  ...MODEL_EXTENSIONS.gltf,
  ...MODEL_EXTENSIONS.glb,
  ...MODEL_EXTENSIONS.fbx,
  ...MODEL_EXTENSIONS.bvh,
  ...MODEL_EXTENSIONS.vrma,
];

/**
 * Model File Extensions Only
 */
export const MODEL_FILE_EXTENSIONS: string[] = [
  ...MODEL_EXTENSIONS.vrm,
  ...MODEL_EXTENSIONS.gltf,
  ...MODEL_EXTENSIONS.glb,
  ...MODEL_EXTENSIONS.fbx,
];

/**
 * Animation File Extensions Only
 */
export const ANIMATION_FILE_EXTENSIONS: string[] = [
  ...ANIMATION_EXTENSIONS.bvh,
  ...ANIMATION_EXTENSIONS.vrma,
];

/**
 * Get file type from extension
 */
export function getFileTypeFromExtension(extension: string): ModelFileType | null {
  const ext = extension.toLowerCase();
  
  if (MODEL_FILE_EXTENSIONS.includes(ext)) {
    return 'model';
  }
  
  if (ANIMATION_FILE_EXTENSIONS.includes(ext)) {
    return 'animation';
  }
  
  return null;
}

/**
 * Get format from extension
 */
export function getFormatFromExtension(extension: string): ModelFormat | AnimationFormat | null {
  const ext = extension.toLowerCase();
  
  for (const [format, extensions] of Object.entries(MODEL_EXTENSIONS)) {
    if (extensions.includes(ext)) {
      return format as ModelFormat;
    }
  }
  
  for (const [format, extensions] of Object.entries(ANIMATION_EXTENSIONS)) {
    if (extensions.includes(ext)) {
      return format as AnimationFormat;
    }
  }
  
  return null;
}

/**
 * Get extension from format
 */
export function getExtensionFromFormat(format: ModelFormat | AnimationFormat): string {
  const extensions = MODEL_EXTENSIONS[format as ModelFormat] || ANIMATION_EXTENSIONS[format as AnimationFormat];
  return extensions ? extensions[0] : '';
}

/**
 * Get MIME type from format
 */
export function getMimeTypeFromFormat(format: ModelFormat | AnimationFormat): string {
  return MIME_TYPES[format] || 'application/octet-stream';
}

/**
 * Check if file is supported
 */
export function isFileSupported(filename: string): boolean {
  const ext = getFileExtension(filename);
  return ALL_SUPPORTED_EXTENSIONS.includes(ext.toLowerCase());
}

/**
 * Get file extension from filename
 */
export function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? `.${parts[parts.length - 1]}` : '';
}

/**
 * Get file size limit for format
 */
export function getFileSizeLimit(format: ModelFormat | AnimationFormat): number {
  return FILE_SIZE_LIMITS[format] || 100 * 1024 * 1024; // Default 100 MB
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Validate file size
 */
export function validateFileSize(file: File, format?: ModelFormat | AnimationFormat): boolean {
  const limit = format ? getFileSizeLimit(format) : 100 * 1024 * 1024;
  return file.size <= limit;
}

/**
 * Get display name for format
 */
export function getFormatDisplayName(format: ModelFormat | AnimationFormat): string {
  return FORMAT_DISPLAY_NAMES[format] || format.toUpperCase();
}
