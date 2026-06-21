// Add a new multiplier row to the Turso `multipliers` table.
//
//   node add-multiplier.mjs \
//     --title "Spec Kit" \
//     --description "A toolkit for spec-driven development…" \
//     --url "https://github.com/github/spec-kit" \
//     --more-info-url "https://github.blog/…" \   (optional)
//     --author-github "github" \                  (optional)
//     --author-email "a@b.com" \                  (optional, used only if no github)
//     --tags "workflow,INTENT"                    (optional but recommended)
//
// Flags:
//   --update              upsert by title instead of erroring on a duplicate
//   --allow-unknown-tags  permit tags not in the tags table (default: reject)
//   --env-file <path>     env file holding TURSO_DATABASE_URL + TURSO_WRITE_TOKEN
//   --help                show usage
//
// Review the contributor submission queue (rows with approved=0):
//   --list-pending        list submissions awaiting review
//   --approve <id>        approve a pending submission (sets approved=1 → live)
//   --reject <id>         delete a pending submission
//
// Convention each row follows: exactly one layer tag (lowercase: prompt, skill,
// tool, harness, workflow, platform) + one pillar tag (UPPERCASE: INTENT,
// LEVERAGE, JUDGMENT). Run check-tags.mjs first to see the vocabulary.

import { createClient } from '@libsql/client';
import { loadWriteEnv } from './_env.mjs';

const FIELD_FLAGS = {
  '--title': 'title',
  '--description': 'description',
  '--url': 'url',
  '--more-info-url': 'more_info_url',
  '--author-github': 'author_github',
  '--author-email': 'author_email',
  '--tags': 'tags',
};

const USAGE = `Add a multiplier.

Required:  --title  --description  --url
Optional:  --more-info-url  --author-github  --author-email  --tags
Flags:     --update  --allow-unknown-tags  --env-file <path>  --help
Review:    --list-pending  --approve <id>  --reject <id>`;

function parseArgs(argv) {
  const out = { row: {}, update: false, allowUnknownTags: false };
  for (let i = 0; i < argv.length; i++) {
    let flag = argv[i];
    let inlineVal;
    const eq = flag.indexOf('=');
    if (flag.startsWith('--') && eq !== -1) {
      inlineVal = flag.slice(eq + 1);
      flag = flag.slice(0, eq);
    }
    const take = () => inlineVal ?? argv[++i];

    if (flag === '--help' || flag === '-h') out.help = true;
    else if (flag === '--update') out.update = true;
    else if (flag === '--allow-unknown-tags') out.allowUnknownTags = true;
    else if (flag === '--env-file') out.envFile = take();
    else if (flag === '--list-pending') out.listPending = true;
    else if (flag === '--approve') out.approve = take();
    else if (flag === '--reject') out.reject = take();
    else if (FIELD_FLAGS[flag]) out.row[FIELD_FLAGS[flag]] = take();
    else throw new Error(`Unknown argument: ${flag}`);
  }
  return out;
}

function normalizeTags(raw) {
  return String(raw ?? '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(USAGE);
    return;
  }

  // ---- Review modes for the contributor submission queue -----------------
  if (args.listPending || args.approve || args.reject) {
    const env = loadWriteEnv({ envFile: args.envFile });
    const db = createClient({ url: env.TURSO_DATABASE_URL, authToken: env.TURSO_WRITE_TOKEN });

    if (args.listPending) {
      const { rows } = await db.execute(
        `SELECT id, title, url, author_github, tags
           FROM multipliers WHERE approved = 0 ORDER BY id`
      );
      if (!rows.length) {
        console.log('No pending submissions.');
        return;
      }
      console.log(`${rows.length} pending submission(s):`);
      for (const r of rows) {
        console.log(
          `  #${r.id}  ${r.title}  [${r.tags ?? ''}]` +
            `${r.author_github ? '  by @' + r.author_github : ''}\n        ${r.url}`
        );
      }
      console.log('\nApprove with --approve <id>, reject with --reject <id>.');
      return;
    }

    const id = Number(args.approve ?? args.reject);
    if (!Number.isInteger(id)) throw new Error('--approve/--reject need a numeric submission id');

    if (args.approve) {
      const res = await db.execute({
        sql: 'UPDATE multipliers SET approved = 1 WHERE id = ? AND approved = 0',
        args: [id],
      });
      if (!res.rowsAffected) throw new Error(`No pending submission #${id} (already approved or missing).`);
      const { rows } = await db.execute({ sql: 'SELECT title FROM multipliers WHERE id = ?', args: [id] });
      console.log(`✓ approved #${id}  ${rows[0]?.title ?? ''} — now live`);
    } else {
      const { rows } = await db.execute({
        sql: 'SELECT title FROM multipliers WHERE id = ? AND approved = 0',
        args: [id],
      });
      if (!rows.length) throw new Error(`No pending submission #${id} (already approved or missing).`);
      await db.execute({ sql: 'DELETE FROM multipliers WHERE id = ? AND approved = 0', args: [id] });
      console.log(`✓ rejected #${id}  ${rows[0].title} — removed`);
    }
    return;
  }

  const row = args.row;
  const required = ['title', 'description', 'url'];
  const missing = required.filter((k) => !row[k] || !String(row[k]).trim());
  if (missing.length) {
    throw new Error(`Missing required field(s): ${missing.map((m) => '--' + m).join(', ')}\n\n${USAGE}`);
  }
  if (!/^https?:\/\//i.test(row.url)) {
    throw new Error(`--url must be an http(s) URL (got: ${row.url})`);
  }
  if (row.more_info_url && !/^https?:\/\//i.test(row.more_info_url)) {
    throw new Error(`--more-info-url must be an http(s) URL (got: ${row.more_info_url})`);
  }

  const tags = normalizeTags(row.tags);
  const env = loadWriteEnv({ envFile: args.envFile });
  const db = createClient({ url: env.TURSO_DATABASE_URL, authToken: env.TURSO_WRITE_TOKEN });

  // Validate tags against the canonical table unless explicitly overridden.
  if (tags.length) {
    const { rows: known } = await db.execute('SELECT name FROM tags');
    const vocab = new Set(known.map((r) => r.name));
    const unknown = tags.filter((t) => !vocab.has(t));
    if (unknown.length && !args.allowUnknownTags) {
      throw new Error(
        `Unknown tag(s): ${unknown.join(', ')}. ` +
          `Run check-tags.mjs to see valid tags, fix the casing (pillars are UPPERCASE), ` +
          `or pass --allow-unknown-tags to insert anyway.`
      );
    }
    if (unknown.length) console.warn(`! inserting with unknown tag(s): ${unknown.join(', ')}`);
  } else {
    console.warn('! no --tags given; this multiplier will not match any tag filter.');
  }

  // Duplicate guard (title and url are UNIQUE).
  const dup = await db.execute({
    sql: 'SELECT id, title, url FROM multipliers WHERE title = ? OR url = ?',
    args: [row.title, row.url],
  });
  if (dup.rows.length && !args.update) {
    const d = dup.rows[0];
    throw new Error(
      `Already exists (#${d.id}: "${d.title}"). ` +
        `Pass --update to upsert by title, or change --title/--url.`
    );
  }

  const values = [
    row.title,
    row.description,
    row.url,
    row.more_info_url ?? null,
    row.author_github ?? null,
    row.author_email ?? null,
    tags.length ? tags.join(',') : null,
  ];

  // Maintainer-added rows go live immediately (approved=1); the contributor API
  // is the only path that inserts approved=0.
  const sql = args.update
    ? `INSERT INTO multipliers
         (title, description, url, more_info_url, author_github, author_email, tags, approved)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)
       ON CONFLICT(title) DO UPDATE SET
         description   = excluded.description,
         url           = excluded.url,
         more_info_url = excluded.more_info_url,
         author_github = excluded.author_github,
         author_email  = excluded.author_email,
         tags          = excluded.tags,
         approved      = 1`
    : `INSERT INTO multipliers
         (title, description, url, more_info_url, author_github, author_email, tags, approved)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`;

  await db.execute({ sql, args: values });

  const { rows: saved } = await db.execute({
    sql: 'SELECT id, title, tags FROM multipliers WHERE title = ?',
    args: [row.title],
  });
  const s = saved[0];
  const verb = args.update && dup.rows.length ? 'updated' : 'added';
  console.log(`✓ ${verb} #${s.id}  ${s.title}  [${s.tags ?? ''}]`);
}

main().catch((e) => {
  console.error(`add-multiplier failed: ${e.message}`);
  process.exit(1);
});
