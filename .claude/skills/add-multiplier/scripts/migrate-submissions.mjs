// One-time migration for the contributor submission flow.
//
//   node .claude/skills/add-multiplier/scripts/migrate-submissions.mjs
//
// Idempotent — safe to run more than once. It:
//   1. adds an `approved` column to `multipliers` (default 0) and backfills
//      every existing row to 1 so the current directory stays visible;
//   2. creates the `contributors` table (one row per GitHub identity);
//   3. creates the `api_tokens` table (stores only a SHA-256 hash of each token).
//
// Uses the same write-token resolution as add-multiplier.mjs (see _env.mjs).

import { createClient } from '@libsql/client';
import { loadWriteEnv } from './_env.mjs';

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === '--env-file') out.envFile = argv[++i];
    else if (flag === '--help' || flag === '-h') out.help = true;
    else throw new Error(`Unknown argument: ${flag}`);
  }
  return out;
}

async function columnExists(db, table, column) {
  const { rows } = await db.execute(`PRAGMA table_info(${table})`);
  return rows.some((r) => r.name === column);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log('Apply the submission-flow migration (approved column + auth tables).');
    return;
  }

  const env = loadWriteEnv({ envFile: args.envFile });
  const db = createClient({ url: env.TURSO_DATABASE_URL, authToken: env.TURSO_WRITE_TOKEN });

  // 1. multipliers.approved — gate live visibility. SQLite has no
  //    ADD COLUMN IF NOT EXISTS, so guard on PRAGMA table_info.
  if (await columnExists(db, 'multipliers', 'approved')) {
    console.log('• multipliers.approved already present — skipping add + backfill');
  } else {
    await db.execute('ALTER TABLE multipliers ADD COLUMN approved INTEGER NOT NULL DEFAULT 0');
    const res = await db.execute('UPDATE multipliers SET approved = 1');
    console.log(`✓ added multipliers.approved and backfilled ${res.rowsAffected} existing row(s) to approved=1`);
  }

  // Optional audit column: which contributor submitted a (pending) row.
  if (await columnExists(db, 'multipliers', 'submitted_by')) {
    console.log('• multipliers.submitted_by already present — skipping');
  } else {
    await db.execute('ALTER TABLE multipliers ADD COLUMN submitted_by INTEGER');
    console.log('✓ added multipliers.submitted_by');
  }

  // 2. contributors — one row per GitHub identity that has authenticated.
  await db.execute(`
    CREATE TABLE IF NOT EXISTS contributors (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      github_id    INTEGER NOT NULL UNIQUE,
      github_login TEXT    NOT NULL,
      github_email TEXT,
      created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at   TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `);
  await db.execute('CREATE INDEX IF NOT EXISTS idx_contributors_login ON contributors(github_login)');
  console.log('✓ contributors table ready');

  // 3. api_tokens — store ONLY the SHA-256 hash; plaintext is shown once at mint.
  await db.execute(`
    CREATE TABLE IF NOT EXISTS api_tokens (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      contributor_id INTEGER NOT NULL REFERENCES contributors(id),
      token_hash     TEXT    NOT NULL UNIQUE,
      token_prefix   TEXT    NOT NULL,
      label          TEXT,
      created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
      last_used_at   TEXT,
      revoked_at     TEXT
    )
  `);
  await db.execute('CREATE INDEX IF NOT EXISTS idx_api_tokens_hash ON api_tokens(token_hash)');
  await db.execute('CREATE INDEX IF NOT EXISTS idx_api_tokens_contributor ON api_tokens(contributor_id)');
  console.log('✓ api_tokens table ready');

  console.log(`\nMigration complete. (source: ${env.source})`);
}

main().catch((e) => {
  console.error(`migrate-submissions failed: ${e.message}`);
  process.exit(1);
});
