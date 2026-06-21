/**
 * GitHub OAuth — step 2 (callback).
 * Verify CSRF state, exchange the code, identify the GitHub user, upsert the
 * contributor, mint a personal API token, set a session cookie, then redirect
 * to /account where the token is revealed once (via a one-time flash cookie).
 *
 * GitHub's access token is used only within this request and never stored — we
 * persist only the GitHub id/login/email and our own token's SHA-256 hash.
 */
import type { APIRoute } from 'astro';
import {
  SESSION_COOKIE,
  SESSION_TTL_SEC,
  STATE_COOKIE,
  TOKEN_FLASH_COOKIE,
  signSession,
  verifyState,
} from '../../../../lib/auth';
import { getWriteDb } from '../../../../lib/db';
import { randomToken, sha256Hex } from '../../../../lib/crypto';

export const prerender = false;

const UA = 'mindcoding-multipliers';

function fail(message: string, status = 400): Response {
  return new Response(message, { status, headers: { 'Content-Type': 'text/plain' } });
}

export const GET: APIRoute = async ({ locals, url, cookies }) => {
  const { env } = locals.runtime;
  const secret = env.TOKEN_SIGNING_SECRET;

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const stateCookie = cookies.get(STATE_COOKIE)?.value;

  // Always clear the single-use state cookie.
  cookies.delete(STATE_COOKIE, { path: '/' });

  if (url.searchParams.get('error')) {
    return fail(`GitHub sign-in was cancelled (${url.searchParams.get('error')}).`);
  }
  if (!code) return fail('Missing authorization code.');
  if (!(await verifyState(secret, stateCookie, state))) {
    return fail('Invalid or expired sign-in state. Please try again.');
  }

  const secure = url.protocol === 'https:';
  const redirectUri = `${url.origin}/api/auth/github/callback`;

  // 1. Exchange the code for a GitHub access token.
  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': UA },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: redirectUri,
    }),
  });
  const tokenJson = (await tokenRes.json().catch(() => ({}))) as {
    access_token?: string;
    error?: string;
  };
  if (!tokenJson.access_token) {
    return fail(`Could not complete GitHub sign-in (${tokenJson.error ?? 'no token'}).`, 502);
  }
  const ghHeaders = {
    Authorization: `Bearer ${tokenJson.access_token}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': UA, // GitHub 403s API calls without a User-Agent.
  };

  // 2. Identify the user.
  const userRes = await fetch('https://api.github.com/user', { headers: ghHeaders });
  if (!userRes.ok) return fail('Could not read your GitHub profile.', 502);
  const user = (await userRes.json()) as { id: number; login: string; email: string | null };

  let email = user.email;
  if (!email) {
    const emailsRes = await fetch('https://api.github.com/user/emails', { headers: ghHeaders });
    if (emailsRes.ok) {
      const emails = (await emailsRes.json()) as Array<{
        email: string;
        primary: boolean;
        verified: boolean;
      }>;
      email = emails.find((e) => e.primary && e.verified)?.email ?? null;
    }
  }

  // 3. Upsert the contributor, keyed on the stable numeric GitHub id.
  const db = getWriteDb(env);
  await db.execute({
    sql: `INSERT INTO contributors (github_id, github_login, github_email)
            VALUES (?, ?, ?)
          ON CONFLICT(github_id) DO UPDATE SET
            github_login = excluded.github_login,
            github_email = excluded.github_email,
            updated_at   = datetime('now')`,
    args: [user.id, user.login, email],
  });
  const { rows } = await db.execute({
    sql: 'SELECT id FROM contributors WHERE github_id = ?',
    args: [user.id],
  });
  const contributorId = rows[0].id as number;

  // 4. Mint a personal API token — store only its hash.
  const { raw, prefix } = randomToken();
  await db.execute({
    sql: `INSERT INTO api_tokens (contributor_id, token_hash, token_prefix, label)
            VALUES (?, ?, ?, ?)`,
    args: [contributorId, await sha256Hex(raw), prefix, 'minted at sign-in'],
  });

  // 5. Session cookie (greets the user, authorises the browser form)…
  cookies.set(SESSION_COOKIE, await signSession(secret, contributorId, user.login), {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SEC,
  });
  // …and a one-time flash cookie carrying the raw token to /account (revealed once).
  cookies.set(TOKEN_FLASH_COOKIE, raw, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: 120,
  });

  return new Response(null, { status: 302, headers: { Location: '/account' } });
};
