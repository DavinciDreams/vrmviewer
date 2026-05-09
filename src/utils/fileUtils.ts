/**
 * File Utilities
 * Provides file type detection, reading, and validation utilities
 */

import {
  getFileExtension,
  getFormatFromExtension,
  getFileTypeFromExtension,
  isFileSupported,
  validateFileSize,
} from '../constants/formats';

/**
 * Read file as text.
 *
 * Prefer the native `Blob.text()` when available (every real browser); fall
 * back to `FileReader.readAsText` for environments whose `Blob` polyfill
 * lacks the streaming method (happy-dom 20.x in our test setup).
 */
export async function readFileAsText(file: File): Promise<string> {
  if (typeof file.text === 'function') {
    return file.text();
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

/**
 * Read file as ArrayBuffer. Same fallback strategy as `readFileAsText`.
 */
export async function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  if (typeof file.arrayBuffer === 'function') {
    return file.arrayBuffer();
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Read file as Data URL
 */
export async function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * Get file info
 */
export function getFileInfo(file: File): {
  name: string;
  size: number;
  type: 'model' | 'animation';
  format: string;
  lastModified: Date;
} {
  const extension = getFileExtension(file.name);
  const format = getFormatFromExtension(extension) || 'unknown';
  const type = getFileTypeFromExtension(extension) || 'model';

  return {
    name: file.name,
    size: file.size,
    type,
    format,
    lastModified: new Date(file.lastModified),
  };
}

/**
 * Validate file for model loading
 */
export function validateModelFile(file: File): { valid: boolean; error?: string } {
  const extension = getFileExtension(file.name);

  if (!isFileSupported(file.name)) {
    return {
      valid: false,
      error: `Unsupported file format: ${extension}`,
    };
  }

  const format = getFormatFromExtension(extension);
  const sizeValid = validateFileSize(file, format ?? undefined);

  if (!sizeValid) {
    return {
      valid: false,
      error: `File size exceeds limit for ${extension} format`,
    };
  }

  return { valid: true };
}

/**
 * Validate file for animation loading
 */
export function validateAnimationFile(file: File): { valid: boolean; error?: string } {
  const extension = getFileExtension(file.name);

  if (!isFileSupported(file.name)) {
    return {
      valid: false,
      error: `Unsupported file format: ${extension}`,
    };
  }

  const format = getFormatFromExtension(extension);
  const sizeValid = validateFileSize(file, format ?? undefined);

  if (!sizeValid) {
    return {
      valid: false,
      error: `File size exceeds limit for ${extension} format`,
    };
  }

  return { valid: true };
}

/**
 * Detect file type from content
 */
export async function detectFileType(arrayBuffer: ArrayBuffer): Promise<{ format: string; type: 'model' | 'animation' } | null> {
  // Check file signatures
  const header = new Uint8Array(arrayBuffer.slice(0, 4));
  const headerStr = String.fromCharCode(...header);

  // GLB signature
  if (headerStr === 'glTF') {
    return { format: 'glb', type: 'model' };
  }

  // FBX signature: binary FBX files begin with "Kaydara FBX Binary".
  // We only sliced 4 bytes above, so compare the first 4 chars ('Kayd').
  if (headerStr === 'Kayd') {
    return { format: 'fbx', type: 'model' };
  }

  // BVH signature (HIERARCHY)
  const text = new TextDecoder().decode(arrayBuffer);
  if (text.trim().toUpperCase().startsWith('HIERARCHY')) {
    return { format: 'bvh', type: 'animation' };
  }

  return null;
}

/**
 * Create object URL from file
 */
export function createObjectURL(file: File): string {
  return URL.createObjectURL(file);
}

/**
 * Revoke object URL
 */
export function revokeObjectURL(url: string): void {
  URL.revokeObjectURL(url);
}
