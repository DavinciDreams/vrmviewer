/**
 * Hash Extraction
 * Computes SHA-256 of a model buffer and an optional perceptual hash of a thumbnail image.
 * Runs in both browser (crypto.subtle, canvas) and Node (node:crypto, no canvas fallback).
 */

function hexFromBuffer(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Compute SHA-256 of an ArrayBuffer.
 * Uses crypto.subtle in the browser or node:crypto in Node.
 */
export async function sha256(buffer: ArrayBuffer): Promise<string> {
  // Browser / modern Node (>=20) with crypto.subtle available
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const digest = await crypto.subtle.digest('SHA-256', buffer);
    return hexFromBuffer(digest);
  }

  // Node fallback — dynamic import avoids bundler issues in browser builds.
  // We use a string expression so the bundler does not attempt to resolve it at build time.
  try {
    const nodeCrypto = await (new Function('m', 'return import(m)') as (m: string) => Promise<{
      createHash: (alg: string) => { update: (d: Uint8Array) => void; digest: (enc: string) => string };
    }>)('crypto');
    const hash = nodeCrypto.createHash('sha256');
    hash.update(new Uint8Array(buffer));
    return hash.digest('hex');
  } catch {
    throw new Error('sha256: no crypto implementation available');
  }
}

/**
 * Compute a simple 8x8 average-hash (aHash) of an image data-URL.
 * Despite the export name, this is technically aHash, not the more elaborate
 * pHash (which uses DCT). aHash is sufficient for the "find similar thumbnails"
 * use case and is ~10x faster. Returns a 16-character hex string (64 bits)
 * or undefined if the environment does not support canvas (e.g. Node without
 * the optional `canvas` package). Never throws — all failures return undefined.
 */
export async function pHash(imageDataUrl: string): Promise<string | undefined> {
  try {
    // Browser path
    if (
      typeof document !== 'undefined' &&
      typeof document.createElement === 'function'
    ) {
      return await browserPHash(imageDataUrl);
    }
    // Node — canvas not available without the optional `canvas` npm package
    return undefined;
  } catch {
    return undefined;
  }
}

async function browserPHash(imageDataUrl: string): Promise<string | undefined> {
  return new Promise<string | undefined>((resolve) => {
    try {
      const SIZE = 8;
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = SIZE;
          canvas.height = SIZE;
          const ctx = canvas.getContext('2d');
          if (!ctx) { resolve(undefined); return; }
          ctx.drawImage(img, 0, 0, SIZE, SIZE);
          const { data } = ctx.getImageData(0, 0, SIZE, SIZE);

          // Convert to grayscale
          const gray: number[] = [];
          for (let i = 0; i < SIZE * SIZE; i++) {
            const r = data[i * 4]!;
            const g = data[i * 4 + 1]!;
            const b = data[i * 4 + 2]!;
            gray.push(0.299 * r + 0.587 * g + 0.114 * b);
          }

          const mean = gray.reduce((a, v) => a + v, 0) / gray.length;

          // Build 64-bit hash as two 32-bit numbers then convert to hex
          let hi = 0;
          let lo = 0;
          for (let i = 0; i < 32; i++) {
            if ((gray[i] ?? 0) >= mean) hi |= (1 << i);
          }
          for (let i = 0; i < 32; i++) {
            if ((gray[32 + i] ?? 0) >= mean) lo |= (1 << i);
          }

          const hiHex = (hi >>> 0).toString(16).padStart(8, '0');
          const loHex = (lo >>> 0).toString(16).padStart(8, '0');
          resolve(hiHex + loHex);
        } catch {
          resolve(undefined);
        }
      };
      img.onerror = () => resolve(undefined);
      img.src = imageDataUrl;
    } catch {
      resolve(undefined);
    }
  });
}
