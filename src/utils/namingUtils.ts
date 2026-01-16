/**
 * Naming Utilities
 * Helper functions for file naming with numerical identifiers
 */

import { v4 as uuidv4 } from 'uuid';

/**
 * Generate a descriptive name from user input
 */
export function generateDescriptiveName(description: string): string {
  // Extract keywords from description
  const words = description.toLowerCase().split(/\s+/);
  const keywords = words.filter((word) => word.length > 3);

  // Combine keywords into a descriptive name
  if (keywords.length >= 2) {
    return keywords.slice(0, 2).join('');
  } else if (keywords.length === 1) {
    return keywords[0];
  }

  // Fallback to a simple name
  const simpleNames = ['animation', 'motion', 'action', 'pose'];
  return simpleNames[Math.floor(Math.random() * simpleNames.length)];
}

/**
 * Generate a unique name with numerical identifier
 */
export function generateUniqueName(
  baseName: string,
  existingNames: string[]
): string {
  // Sanitize base name
  const sanitizedName = sanitizeName(baseName);

  // Find the next available number
  const number = findNextAvailableNumber(sanitizedName, existingNames);

  return `${sanitizedName}${number}`;
}

/**
 * Find the next available numerical identifier
 */
export function findNextAvailableNumber(baseName: string, existingNames: string[]): number {
  let number = 1;

  while (true) {
    const candidateName = `${baseName}${number}`;

    // Check if this name exists
    if (!existingNames.includes(candidateName)) {
      return number;
    }

    number++;
  }
}

/**
 * Check for name conflict
 */
export function hasNameConflict(name: string, existingNames: string[]): boolean {
  return existingNames.includes(name);
}

/**
 * Suggest unique names based on a pattern
 */
export function suggestNames(
  pattern: string,
  count: number = 5
): string[] {
  const suggestions: string[] = [];

  for (let i = 1; i <= count; i++) {
    suggestions.push(`${pattern}${i}`);
  }

  return suggestions;
}

/**
 * Sanitize file name
 */
export function sanitizeName(name: string): string {
  // Remove any characters that aren't alphanumeric, hyphens, or underscores
  let sanitized = name.replace(/[^a-zA-Z0-9_-]/g, '_');

  // Remove consecutive underscores
  sanitized = sanitized.replace(/_{2,}/g, '_');

  // Remove leading/trailing underscores and hyphens
  sanitized = sanitized.replace(/^[-_]+|[-_]+$/g, '');

  // Remove leading/trailing spaces
  sanitized = sanitized.trim();

  // Ensure name is not empty
  if (!sanitized) {
    sanitized = 'unnamed';
  }

  // Limit length
  const maxLength = 100;
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  return sanitized;
}

/**
 * Validate name
 */
export function validateName(name: string): { valid: boolean; error?: string } {
  if (!name || name.trim() === '') {
    return { valid: false, error: 'Name cannot be empty' };
  }

  const sanitizedName = sanitizeName(name);

  if (sanitizedName.length === 0) {
    return { valid: false, error: 'Name cannot be empty' };
  }

  if (sanitizedName.length > 100) {
    return { valid: false, error: 'Name cannot exceed 100 characters' };
  }

  // Check for invalid patterns
  const invalidPatterns = [
    /^(con|prn|aux|nul|com[0-9])(.+)$/i, // Reserved Windows names
    /^\./, // Starts with dot
    /\s{2,}$/, // Contains double spaces
  ];

  for (const pattern of invalidPatterns) {
    if (pattern.test(sanitizedName)) {
      return { valid: false, error: 'Name contains invalid characters or patterns' };
    }
  }

  return { valid: true };
}

/**
 * Generate a UUID-based name
 */
export function generateUUIDName(prefix: string = 'item'): string {
  const uuid = uuidv4();
  return `${prefix}_${uuid.substring(0, 8)}`;
}

/**
 * Parse name and extract number
 */
export function parseNameNumber(name: string): { baseName: string; number: number | null } {
  const match = name.match(/^(.+?)(\d+)$/);

  if (match) {
    return {
      baseName: match[1],
      number: parseInt(match[2], 10),
    };
  }

  return { baseName: name, number: null };
}

/**
 * Extract base name from numbered name
 */
export function extractBaseName(name: string): string {
  const match = name.match(/^(.+?)(\d+)$/);
  return match ? match[1] : name;
}

/**
 * Generate a suggested name based on existing names
 */
export function generateSuggestedName(
  baseName: string,
  existingNames: string[],
  description?: string
): string {
  // Try to generate a descriptive name from description
  let suggestedName = description ? generateDescriptiveName(description) : baseName;

  // Check for conflicts and add number if needed
  if (hasNameConflict(suggestedName, existingNames)) {
    suggestedName = generateUniqueName(suggestedName, existingNames);
  }

  return suggestedName;
}

/**
 * Generate name variations
 */
export function generateNameVariations(baseName: string): string[] {
  const variations: string[] = [];
  const prefixes = ['slowly', 'quickly', 'happily', 'sadly', 'carefully'];
  const suffixes = ['walk', 'run', 'jump', 'dance', 'wave'];

  // Add base name
  variations.push(baseName);

  // Add prefixed variations
  prefixes.forEach((prefix) => {
    variations.push(`${prefix}${baseName}`);
  });

  // Add suffixed variations
  suffixes.forEach((suffix) => {
    variations.push(`${baseName}${suffix}`);
  });

  return variations;
}

/**
 * Format name for display
 */
export function formatNameForDisplay(name: string): string {
  // Convert underscores to spaces for display
  return name.replace(/_/g, ' ');
}

/**
 * Generate a timestamped name
 */
export function generateTimestampedName(baseName: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const shortTimestamp = timestamp.substring(0, 8);

  return `${baseName}_${shortTimestamp}`;
}

/**
 * Create a backup name
 */
export function createBackupName(originalName: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const shortTimestamp = timestamp.substring(0, 8);

  return `${originalName}_backup_${shortTimestamp}`;
}

/**
 * Compare two names and determine if they are similar
 */
export function areNamesSimilar(name1: string, name2: string): boolean {
  // Remove numbers for comparison
  const base1 = name1.replace(/\d+$/g, '');
  const base2 = name2.replace(/\d+$/g, '');

  // Check if base names are the same
  return base1.toLowerCase() === base2.toLowerCase();
}

/**
 * Sort names by type
 */
export function sortNamesByType(names: string[]): { animations: string[]; models: string[] } {
  const result: { animations: string[], models: string[] } = { animations: [], models: [] };

  names.forEach((name) => {
    const match = name.match(/(\d+)$/);

    if (match) {
      // It's a numbered name, could be animation
      result.animations.push(name);
    } else {
      result.models.push(name);
    }
  });

  return result;
}

/**
 * Check if name is animation-like
 */
export function isAnimationName(name: string): boolean {
  const animationKeywords = [
    'walk', 'run', 'jump', 'dance', 'wave',
    'idle', 'action', 'motion', 'pose', 'gesture',
  ];

  const lowerName = name.toLowerCase();
  return animationKeywords.some((keyword) => lowerName.includes(keyword));
}

/**
 * Check if name is model-like
 */
export function isModelName(name: string): boolean {
  const modelKeywords = [
    'character', 'avatar', 'model', 'skin', 'outfit',
    'clothing', 'costume', 'accessory', 'prop',
  ];

  const lowerName = name.toLowerCase();
  return modelKeywords.some((keyword) => lowerName.includes(keyword));
}

/**
 * Get name suggestions for a given input
 */
export function getNameSuggestions(
  input: string,
  existingNames: string[],
  maxSuggestions: number = 10
): string[] {
  const suggestions: string[] = [];
  const sanitizedInput = sanitizeName(input);

  // Add variations of the input
  const variations = generateNameVariations(sanitizedInput);
  suggestions.push(...variations.slice(0, 5));

  // Add numbered versions
  for (let i = 1; i <= 3 && suggestions.length < maxSuggestions; i++) {
    suggestions.push(`${sanitizedInput}${i}`);
  }

  return suggestions;
}
