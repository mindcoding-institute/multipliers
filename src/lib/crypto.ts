/**
 * Web Crypto helpers — all built on `crypto.subtle`, so they run inside
 * Cloudflare Workers with no node dependencies.
 *
 *   - API tokens are random 32-byte secrets, stored only as their SHA-256 hash.
 *   - The OAuth `state` and the browser session are carried in HMAC-signed
 *     cookies (no KV namespace needed for CSRF state).
 */

const encoder = new TextEncoder();

/** base64url-encode bytes (no padding) — URL/cookie safe. */
export function base64urlEncode(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Decode a base64url string back to bytes. */
export function base64urlDecode(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Hex SHA-256 of a string — used to hash API tokens before storage/lookup. */
export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

/** HMAC-SHA256 sign a message; returns a base64url signature. */
export async function hmacSign(secret: string, message: string): Promise<string> {
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return base64urlEncode(new Uint8Array(sig));
}

/** Constant-time verify of an HMAC signature produced by {@link hmacSign}. */
export async function hmacVerify(secret: string, message: string, signature: string): Promise<boolean> {
  try {
    const key = await hmacKey(secret);
    return await crypto.subtle.verify(
      'HMAC',
      key,
      base64urlDecode(signature),
      encoder.encode(message)
    );
  } catch {
    return false;
  }
}

/**
 * Mint a fresh API token: 32 bytes of randomness, base64url-encoded, prefixed
 * `mcp_`. Returns the raw token (shown to the user once) and a short display
 * prefix to store alongside the hash.
 */
export function randomToken(): { raw: string; prefix: string } {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const raw = 'mcp_' + base64urlEncode(bytes);
  return { raw, prefix: raw.slice(0, 12) };
}

/** A short random opaque value (e.g. OAuth state nonce). */
export function randomNonce(byteLength = 16): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return base64urlEncode(bytes);
}
