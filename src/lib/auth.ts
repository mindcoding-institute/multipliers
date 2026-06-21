/**
 * Auth for the submission flow.
 *
 *   - API callers (skill/CLI/curl) send `Authorization: Bearer mcp_…`; we hash
 *     it and look it up in `api_tokens`.
 *   - The browser carries an HMAC-signed `mcp_session` cookie minted at the end
 *     of the GitHub OAuth flow; the form posts use it instead of a raw token.
 *   - The OAuth CSRF `state` lives in a short-lived HMAC-signed `oauth_state`
 *     cookie — the cookie *is* the state store, so no KV namespace is needed.
 *
 * All crypto is Web Crypto via ./crypto, so this runs in Workers.
 */

import { getReadDb, getWriteDb } from './db';
import { hmacSign, hmacVerify, sha256Hex } from './crypto';

export const SESSION_COOKIE = 'mcp_session';
export const STATE_COOKIE = 'oauth_state';
/** One-time cookie carrying a freshly minted token to the /account reveal page. */
export const TOKEN_FLASH_COOKIE = 'mcp_token_flash';

export const SESSION_TTL_SEC = 60 * 60; // 1 hour
export const STATE_TTL_SEC = 10 * 60; // 10 minutes

/** A resolved, authenticated contributor. */
export interface AuthedContributor {
  contributorId: number;
  githubLogin: string;
  via: 'token' | 'session';
}

function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

// ---- API token (Bearer) --------------------------------------------------

/**
 * Resolve a `Bearer mcp_…` header to its contributor. Returns null on any
 * miss (no/!Bearer header, unknown hash, revoked). Best-effort throttled
 * `last_used_at` bump (only when stale) so we don't write on every request.
 */
export async function resolveBearer(
  env: Env,
  authorization: string | null
): Promise<AuthedContributor | null> {
  if (!authorization) return null;
  const m = authorization.match(/^Bearer\s+(\S+)$/i);
  if (!m) return null;

  const tokenHash = await sha256Hex(m[1]);
  const read = getReadDb(env);
  const { rows } = await read.execute({
    sql: `SELECT t.id AS token_id, t.contributor_id, c.github_login
            FROM api_tokens t
            JOIN contributors c ON c.id = t.contributor_id
           WHERE t.token_hash = ? AND t.revoked_at IS NULL
           LIMIT 1`,
    args: [tokenHash],
  });
  if (!rows.length) return null;
  const row = rows[0] as unknown as {
    token_id: number;
    contributor_id: number;
    github_login: string;
  };

  // Throttled last_used bump — only touches a row gone stale (> 1h).
  try {
    await getWriteDb(env).execute({
      sql: `UPDATE api_tokens SET last_used_at = datetime('now')
             WHERE id = ? AND (last_used_at IS NULL OR last_used_at < datetime('now', '-1 hour'))`,
      args: [row.token_id],
    });
  } catch {
    // non-fatal: auth still succeeds even if the bump fails
  }

  return { contributorId: row.contributor_id, githubLogin: row.github_login, via: 'token' };
}

// ---- Session cookie ------------------------------------------------------

/** Build the signed `mcp_session` value: `contributorId.login.expiry.sig`. */
export async function signSession(
  secret: string,
  contributorId: number,
  login: string
): Promise<string> {
  const exp = nowSec() + SESSION_TTL_SEC;
  const payload = `${contributorId}.${login}.${exp}`;
  const sig = await hmacSign(secret, payload);
  return `${payload}.${sig}`;
}

/** Verify an `mcp_session` value; null if tampered or expired. */
export async function verifySession(
  secret: string,
  value: string | undefined | null
): Promise<{ contributorId: number; githubLogin: string } | null> {
  if (!value) return null;
  const parts = value.split('.');
  if (parts.length !== 4) return null;
  const [idStr, login, expStr, sig] = parts;
  const payload = `${idStr}.${login}.${expStr}`;
  if (!(await hmacVerify(secret, payload, sig))) return null;
  if (Number(expStr) < nowSec()) return null;
  const contributorId = Number(idStr);
  if (!Number.isInteger(contributorId)) return null;
  return { contributorId, githubLogin: login };
}

/** Bearer token first, then session cookie. */
export async function resolveAuth(
  env: Env,
  { authorization, sessionCookie }: { authorization: string | null; sessionCookie?: string | null }
): Promise<AuthedContributor | null> {
  const byToken = await resolveBearer(env, authorization);
  if (byToken) return byToken;
  const sess = await verifySession(env.TOKEN_SIGNING_SECRET, sessionCookie);
  if (sess) return { ...sess, via: 'session' };
  return null;
}

// ---- OAuth state cookie --------------------------------------------------

/** Build the signed `oauth_state` value: `state.expiry.sig`. */
export async function signState(secret: string, state: string): Promise<string> {
  const exp = nowSec() + STATE_TTL_SEC;
  const payload = `${state}.${exp}`;
  const sig = await hmacSign(secret, payload);
  return `${payload}.${sig}`;
}

/** Verify the `oauth_state` cookie against the state echoed back by GitHub. */
export async function verifyState(
  secret: string,
  cookieValue: string | undefined | null,
  echoedState: string | null
): Promise<boolean> {
  if (!cookieValue || !echoedState) return false;
  const parts = cookieValue.split('.');
  if (parts.length !== 3) return false;
  const [state, expStr, sig] = parts;
  if (state !== echoedState) return false;
  if (!(await hmacVerify(secret, `${state}.${expStr}`, sig))) return false;
  if (Number(expStr) < nowSec()) return false;
  return true;
}
