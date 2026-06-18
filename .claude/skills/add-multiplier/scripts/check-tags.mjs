// List the canonical tags (from the `tags` table) with how many multipliers
// use each, or validate a set of tags you intend to apply.
//
//   node check-tags.mjs                       list all tags, grouped, with usage
//   node check-tags.mjs skill,LEVERAGE        validate these tags (exit 1 if any unknown)
//   node check-tags.mjs --env-file ../.dev.vars   point at a specific env file
//
// Tags are case-sensitive: layer tags are lowercase (prompt, skill, tool,
// harness, workflow, platform); pillar tags are UPPERCASE (INTENT, LEVERAGE,
// JUDGMENT). The site's filter only offers tags that exist in this table, so a
// multiplier carrying an unknown tag would render a chip nobody can filter by.

import { createClient } from '@libsql/client';
import { loadWriteEnv } from './_env.mjs';

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--env-file') args.envFile = argv[++i];
    else if (a.startsWith('--env-file=')) args.envFile = a.slice('--env-file='.length);
    else args._.push(a);
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const env = loadWriteEnv({ envFile: args.envFile });
const db = createClient({ url: env.TURSO_DATABASE_URL, authToken: env.TURSO_WRITE_TOKEN });

const { rows } = await db.execute('SELECT name, "group", description FROM tags ORDER BY "group", name');
const known = new Set(rows.map((r) => r.name));

// Usage counts across the comma-delimited multipliers.tags column.
const { rows: mult } = await db.execute('SELECT tags FROM multipliers');
const counts = new Map();
for (const r of mult) {
  for (const t of String(r.tags ?? '').split(',').map((s) => s.trim()).filter(Boolean)) {
    counts.set(t, (counts.get(t) ?? 0) + 1);
  }
}

// Validation mode: any positional args are treated as tags (comma or space separated).
const toCheck = args._.flatMap((a) => a.split(',')).map((s) => s.trim()).filter(Boolean);
if (toCheck.length) {
  let ok = true;
  console.log('Validating tags:');
  for (const t of toCheck) {
    if (known.has(t)) console.log(`  ✓ ${t}`);
    else {
      ok = false;
      console.log(`  ✗ ${t}  (unknown — not in the tags table)`);
    }
  }
  process.exit(ok ? 0 : 1);
}

// Listing mode: grouped, with usage counts.
let group;
for (const r of rows) {
  if (r.group !== group) {
    group = r.group;
    console.log(`\n[${group ?? 'ungrouped'}]`);
  }
  const n = counts.get(r.name) ?? 0;
  console.log(
    `  ${String(r.name).padEnd(12)} ${String(n).padStart(2)}×   ${r.description ?? ''}`
  );
}

// Surface any tags used by multipliers but missing from the table (orphans).
const orphans = [...counts.keys()].filter((t) => !known.has(t));
if (orphans.length) {
  console.log(`\n[!] orphan tags used but not in the table: ${orphans.join(', ')}`);
}
console.log('');
