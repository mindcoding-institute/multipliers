/**
 * Submission validation — the network-facing twin of add-multiplier.mjs.
 * The same required-field, URL-shape, tag-vocabulary, and duplicate checks the
 * CLI enforces, ported to TypeScript so the API endpoint and the no-JS form
 * share one source of truth. Pure (no node deps) — runs in Workers.
 */

import type { Client } from '@libsql/client/web';

export interface SubmissionInput {
  title?: string;
  description?: string;
  url?: string;
  more_info_url?: string;
  author_email?: string;
  tags?: string;
}

export interface CleanRow {
  title: string;
  description: string;
  url: string;
  more_info_url: string | null;
  author_email: string | null;
  tags: string[];
}

export type ValidationResult =
  | { ok: true; row: CleanRow }
  | { ok: false; errors: string[] };

/** Split a comma string into trimmed, non-empty tag slugs (matches the CLI). */
export function normalizeTags(raw: string | undefined | null): string[] {
  return String(raw ?? '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

const HTTP_RE = /^https?:\/\//i;
const MAX = { title: 120, description: 2000, url: 500 };

/** Required fields present + http(s) URLs + sane lengths. Mirrors the CLI. */
export function validateSubmission(input: SubmissionInput): ValidationResult {
  const errors: string[] = [];
  const title = (input.title ?? '').trim();
  const description = (input.description ?? '').trim();
  const url = (input.url ?? '').trim();
  const moreInfo = (input.more_info_url ?? '').trim();
  const authorEmail = (input.author_email ?? '').trim();

  if (!title) errors.push('title is required');
  if (!description) errors.push('description is required');
  if (!url) errors.push('url is required');

  if (title.length > MAX.title) errors.push(`title must be ≤ ${MAX.title} chars`);
  if (description.length > MAX.description) errors.push(`description must be ≤ ${MAX.description} chars`);
  if (url && !HTTP_RE.test(url)) errors.push('url must be an http(s) URL');
  if (moreInfo && !HTTP_RE.test(moreInfo)) errors.push('more_info_url must be an http(s) URL');

  if (errors.length) return { ok: false, errors };

  return {
    ok: true,
    row: {
      title,
      description,
      url,
      more_info_url: moreInfo || null,
      author_email: authorEmail || null,
      tags: normalizeTags(input.tags),
    },
  };
}

/** Set-diff the given tags against the canonical `tags` table. */
export async function validateTags(db: Client, tags: string[]): Promise<{ unknown: string[] }> {
  if (!tags.length) return { unknown: [] };
  const { rows } = await db.execute('SELECT name FROM tags');
  const vocab = new Set(rows.map((r) => r.name as string));
  return { unknown: tags.filter((t) => !vocab.has(t)) };
}

export interface DuplicateHit {
  id: number;
  title: string;
  url: string;
}

/**
 * Reject titles/urls already present in `multipliers` — approved OR pending —
 * so a friendly 409 is returned before the UNIQUE constraint would throw.
 */
export async function checkDuplicates(
  db: Client,
  { title, url }: { title: string; url: string }
): Promise<DuplicateHit | null> {
  const { rows } = await db.execute({
    sql: 'SELECT id, title, url FROM multipliers WHERE title = ? OR url = ? LIMIT 1',
    args: [title, url],
  });
  return rows.length ? (rows[0] as unknown as DuplicateHit) : null;
}

/** How many pending (unapproved) rows this contributor already has queued. */
export async function countPending(db: Client, contributorId: number): Promise<number> {
  const { rows } = await db.execute({
    sql: 'SELECT count(*) AS n FROM multipliers WHERE submitted_by = ? AND approved = 0',
    args: [contributorId],
  });
  return Number(rows[0]?.n ?? 0);
}

/**
 * Insert a validated row as a pending submission (approved=0). `author_github`
 * is forced from the authenticated contributor so attribution can't be spoofed.
 * Returns the new row id.
 */
export async function insertPending(
  db: Client,
  row: CleanRow,
  { contributorId, githubLogin }: { contributorId: number; githubLogin: string }
): Promise<number> {
  const res = await db.execute({
    sql: `INSERT INTO multipliers
            (title, description, url, more_info_url, author_github, author_email, tags, approved, submitted_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`,
    args: [
      row.title,
      row.description,
      row.url,
      row.more_info_url,
      githubLogin,
      row.author_email,
      row.tags.length ? row.tags.join(',') : null,
      contributorId,
    ],
  });
  return Number(res.lastInsertRowid ?? 0);
}

/** Max pending submissions a single contributor may hold at once. */
export const MAX_PENDING_PER_CONTRIBUTOR = 20;
