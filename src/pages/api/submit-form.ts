/**
 * POST /api/submit-form — no-JS fallback for the browser form.
 * Session-authenticated (cookie), reads urlencoded fields, runs the same
 * validation/insert path as /api/submit, then redirects back to /submit with a
 * status so the themed page can show the outcome.
 */
import type { APIRoute } from 'astro';
import { SESSION_COOKIE, verifySession } from '../../lib/auth';
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

function back(params: Record<string, string>): Response {
  const qs = new URLSearchParams(params).toString();
  return new Response(null, { status: 302, headers: { Location: `/submit?${qs}` } });
}

export const POST: APIRoute = async ({ request, locals, cookies, url }) => {
  const { env } = locals.runtime;

  const sess = await verifySession(env.TOKEN_SIGNING_SECRET, cookies.get(SESSION_COOKIE)?.value);
  if (!sess) return back({ status: 'err', msg: 'Please sign in first.' });

  const origin = request.headers.get('origin');
  if (origin && origin !== url.origin) return new Response('forbidden', { status: 403 });

  const form = await request.formData();
  const input = {
    title: String(form.get('title') ?? ''),
    description: String(form.get('description') ?? ''),
    url: String(form.get('url') ?? ''),
    more_info_url: String(form.get('more_info_url') ?? ''),
    author_email: String(form.get('author_email') ?? ''),
    tags: form.getAll('tags').map(String).join(','),
  };

  const result = validateSubmission(input);
  if (!result.ok) return back({ status: 'err', msg: result.errors.join('; ') });
  const { row } = result;

  const read = getReadDb(env);
  const { unknown } = await validateTags(read, row.tags);
  if (unknown.length) return back({ status: 'err', msg: `Unknown tag(s): ${unknown.join(', ')}` });

  const dup = await checkDuplicates(read, { title: row.title, url: row.url });
  if (dup) return back({ status: 'err', msg: `Already in the directory: "${dup.title}".` });

  const write = getWriteDb(env);
  if ((await countPending(write, sess.contributorId)) >= MAX_PENDING_PER_CONTRIBUTOR) {
    return back({ status: 'err', msg: 'You have too many submissions awaiting review.' });
  }

  try {
    const id = await insertPending(write, row, {
      contributorId: sess.contributorId,
      githubLogin: sess.githubLogin,
    });
    return back({ status: 'ok', id: String(id) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    if (/UNIQUE/i.test(msg)) return back({ status: 'err', msg: 'Already in the directory.' });
    return back({ status: 'err', msg: 'Something went wrong. Please try again.' });
  }
};
