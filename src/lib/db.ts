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
}

/**
 * Build a libSQL client from the Cloudflare runtime env. The `/web` entrypoint
 * speaks Hrana over HTTP (fetch), so it runs inside Workers with no node deps.
 */
export function getDb(env: Env): Client {
  return createClient({
    url: env.TURSO_DATABASE_URL,
    authToken: env.TURSO_AUTH_TOKEN,
  });
}

/** Fetch all multipliers, alphabetised by title (case-insensitive). */
export async function listMultipliers(env: Env): Promise<Multiplier[]> {
  const db = getDb(env);
  const { rows } = await db.execute(
    `SELECT id, title, description, url, more_info_url, author_github, author_email
       FROM multipliers
      ORDER BY title COLLATE NOCASE`
  );
  // libSQL rows are array-like row objects; cast through unknown to our shape.
  return rows as unknown as Multiplier[];
}
