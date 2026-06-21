/**
 * POST /api/auth/revoke — revoke one of the signed-in contributor's API tokens.
 * Session-authenticated; a contributor can only revoke tokens they own.
 * Accepts a form post (`token_id`) and redirects back to /account.
 */
import type { APIRoute } from 'astro';
import { SESSION_COOKIE, verifySession } from '../../../lib/auth';
import { getWriteDb } from '../../../lib/db';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals, cookies, url }) => {
  const { env } = locals.runtime;
  const sess = await verifySession(env.TOKEN_SIGNING_SECRET, cookies.get(SESSION_COOKIE)?.value);
  if (!sess) return new Response(null, { status: 302, headers: { Location: '/account' } });

  // CSRF: only honour same-origin form posts.
  const origin = request.headers.get('origin');
  if (origin && origin !== url.origin) return new Response('forbidden', { status: 403 });

  const form = await request.formData();
  const tokenId = Number(form.get('token_id'));
  if (Number.isInteger(tokenId)) {
    await getWriteDb(env).execute({
      sql: `UPDATE api_tokens SET revoked_at = datetime('now')
             WHERE id = ? AND contributor_id = ? AND revoked_at IS NULL`,
      args: [tokenId, sess.contributorId],
    });
  }
  return new Response(null, { status: 302, headers: { Location: '/account?revoked=1' } });
};
