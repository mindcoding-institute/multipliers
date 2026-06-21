/**
 * POST /api/submit — the contributor submission API (JSON).
 *
 * Auth: `Authorization: Bearer mcp_…` (skill/CLI/curl), or the `mcp_session`
 * cookie for same-origin browser fetches (which must also send a custom header,
 * so a cross-site form can't drive the cookie path).
 *
 * Body: { title, description, url, more_info_url?, author_email?, tags? }
 * Inserts a pending row (approved=0); a maintainer approves it later.
 */
import type { APIRoute } from 'astro';
import { SESSION_COOKIE, resolveAuth } from '../../lib/auth';
import { getReadDb, getWriteDb } from '../../lib/db';
import {
  MAX_PENDING_PER_CONTRIBUTOR,
  checkDuplicates,
  countPending,
  insertPending,
  validateSubmission,
  validateTags,
} from '../../lib/submissions';

export const prerender = false;

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const POST: APIRoute = async ({ request, locals, cookies, url }) => {
  const { env } = locals.runtime;

  // 1. Authenticate.
  const auth = await resolveAuth(env, {
    authorization: request.headers.get('authorization'),
    sessionCookie: cookies.get(SESSION_COOKIE)?.value,
  });
  if (!auth) return json({ error: 'unauthorized' }, 401);

  // CSRF: the cookie path is only honoured for same-origin requests carrying a
  // custom header. Bearer (token) callers are exempt — no ambient credentials.
  if (auth.via === 'session') {
    const origin = request.headers.get('origin');
    const sameOrigin = !origin || origin === url.origin;
    if (!sameOrigin || !request.headers.get('x-requested-with')) {
      return json({ error: 'forbidden' }, 403);
    }
  }

  // 2. Parse JSON.
  if (!request.headers.get('content-type')?.includes('application/json')) {
    return json({ error: 'expected application/json' }, 400);
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid JSON' }, 400);
  }

  // 3. Validate fields.
  const result = validateSubmission(body as Record<string, string>);
  if (!result.ok) return json({ error: 'validation', details: result.errors }, 400);
  const { row } = result;

  const read = getReadDb(env);

  // 4. Validate tags against the canonical vocabulary.
  const { unknown } = await validateTags(read, row.tags);
  if (unknown.length) return json({ error: 'unknown_tags', details: unknown }, 400);

  // 5. Reject duplicates (approved or pending).
  const dup = await checkDuplicates(read, { title: row.title, url: row.url });
  if (dup) return json({ error: 'duplicate', existing: dup }, 409);

  // 6. Rate cap: bound how many pending rows one contributor can hold.
  const write = getWriteDb(env);
  if ((await countPending(write, auth.contributorId)) >= MAX_PENDING_PER_CONTRIBUTOR) {
    return json(
      { error: 'rate_limited', detail: `You already have ${MAX_PENDING_PER_CONTRIBUTOR} submissions awaiting review.` },
      429
    );
  }

  // 7. Insert (author_github forced from the authenticated contributor).
  let id: number;
  try {
    id = await insertPending(write, row, auth);
  } catch (e) {
    // UNIQUE backstop in case the dup check raced a concurrent insert.
    const msg = e instanceof Error ? e.message : '';
    if (/UNIQUE/i.test(msg)) return json({ error: 'duplicate' }, 409);
    return json({ error: 'server_error' }, 500);
  }

  return json({ id, status: 'pending', author_github: auth.githubLogin }, 201);
};
