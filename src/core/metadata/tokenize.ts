/**
 * Search Token Extraction
 * Produces a deduplicated, normalized list of tokens for full-text search indexing.
 */

export interface TokenizeInput {
  name?: string;
  displayName?: string;
  description?: string;
  tags?: string[];
  author?: string;
  license?: string;
}

const MIN_LEN = 2;
const MAX_LEN = 40;
const MAX_TOKENS = 100;

/** Insert a space before each uppercase letter that follows a lowercase letter (CamelCase split). */
function splitCamelCase(s: string): string {
  return s.replace(/([a-z])([A-Z])/g, '$1 $2');
}

export function tokenize(record: TokenizeInput): string[] {
  const parts: string[] = [];

  if (record.name) parts.push(record.name);
  if (record.displayName) parts.push(record.displayName);
  if (record.description) parts.push(record.description);
  if (record.author) parts.push(record.author);
  if (record.license) parts.push(record.license);
  if (record.tags) parts.push(...record.tags);

  const combined = parts.join(' ');

  // Split CamelCase before tokenizing
  const expanded = splitCamelCase(combined);

  // Split on anything that is not alphanumeric
  const rawTokens = expanded.split(/[^a-zA-Z0-9]+/);

  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of rawTokens) {
    const token = raw.toLowerCase();
    if (token.length < MIN_LEN || token.length > MAX_LEN) continue;
    if (seen.has(token)) continue;
    seen.add(token);
    result.push(token);
    if (result.length >= MAX_TOKENS) break;
  }

  return result;
}
