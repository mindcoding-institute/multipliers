import { createClient, type Client } from '@libsql/client/web';

/**
 * A single multiplier row, mirroring the `multipliers` table.
 *   id, title, description, url are NOT NULL; the rest are nullable.
 */
export interface Multiplier {
  id: number;
  title: string;
  description: string;
  url: string;
  more_info_url: string | null;
  author_github: string | null;
  author_email: string | null;
  /** Comma-delimited tag slugs, e.g. "skills,judgment". May be null/empty. */
  tags: string | null;
}

/** A canonical tag from the `tags` lookup table. */
export interface Tag {
  name: string;
  group: string | null;
  description: string | null;
}

/** Split the comma-delimited tags column into trimmed, non-empty slugs. */
export function parseTags(tags: string | null): string[] {
  if (!tags) return [];
  return tags
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

/**
 * Build a libSQL client. The `/web` entrypoint speaks Hrana over HTTP (fetch),
 * so it runs inside Workers with no node deps. Pass the read or write token
 * explicitly so the privilege used at each call site is unambiguous.
 */
export function getDb(url: string, authToken: string): Client {
  return createClient({ url, authToken });
}

/** A read-only client (listing, lookups). */
export function getReadDb(env: Env): Client {
  return getDb(env.TURSO_DATABASE_URL, env.TURSO_READ_TOKEN);
}

/** A read-write client (future submission flow). */
export function getWriteDb(env: Env): Client {
  return getDb(env.TURSO_DATABASE_URL, env.TURSO_WRITE_TOKEN);
}

/** Fetch all multipliers, alphabetised by title (case-insensitive). */
export async function listMultipliers(env: Env): Promise<Multiplier[]> {
  const db = getReadDb(env);
  const { rows } = await db.execute(
    `SELECT id, title, description, url, more_info_url, author_github, author_email, tags
       FROM multipliers
      ORDER BY title COLLATE NOCASE`
  );
  // libSQL rows are array-like row objects; cast through unknown to our shape.
  return rows as unknown as Multiplier[];
}

/** Fetch the canonical tags (name + group), grouped vocabulary for display. */
export async function listTags(env: Env): Promise<Tag[]> {
  const db = getReadDb(env);
  const { rows } = await db.execute(
    `SELECT name, "group", description FROM tags ORDER BY "group", name`
  );
  return rows as unknown as Tag[];
}
