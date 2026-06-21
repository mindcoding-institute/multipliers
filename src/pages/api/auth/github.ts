/**
 * GitHub OAuth — step 1 (start).
 * Stash a signed CSRF `state` in a short-lived cookie, then redirect to GitHub.
 */
import type { APIRoute } from 'astro';
import { STATE_COOKIE, STATE_TTL_SEC, signState } from '../../../lib/auth';
import { randomNonce } from '../../../lib/crypto';

export const prerender = false;

export const GET: APIRoute = async ({ locals, url, cookies }) => {
  const { env } = locals.runtime;
  if (!env.GITHUB_CLIENT_ID || !env.TOKEN_SIGNING_SECRET) {
    return new Response('GitHub sign-in is not configured.', { status: 500 });
  }

  const state = randomNonce();
  cookies.set(STATE_COOKIE, await signState(env.TOKEN_SIGNING_SECRET, state), {
    httpOnly: true,
    secure: url.protocol === 'https:',
    sameSite: 'lax',
    path: '/',
    maxAge: STATE_TTL_SEC,
  });

  const redirectUri = `${url.origin}/api/auth/github/callback`;
  const authorize = new URL('https://github.com/login/oauth/authorize');
  authorize.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
  authorize.searchParams.set('redirect_uri', redirectUri);
  authorize.searchParams.set('scope', 'read:user user:email');
  authorize.searchParams.set('state', state);
  authorize.searchParams.set('allow_signup', 'true');

  return new Response(null, { status: 302, headers: { Location: authorize.toString() } });
};
