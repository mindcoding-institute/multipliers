// Submit a multiplier to the Mind Coding directory via the public API.
//
//   node submit-multiplier.mjs \
//     --title "Spec Kit" \
//     --description "A toolkit for spec-driven development…" \
//     --url "https://github.com/github/spec-kit" \
//     --more-info-url "https://github.blog/…" \   (optional)
//     --author-email "a@b.com" \                  (optional)
//     --tags "workflow,INTENT"                     (optional but recommended)
//
//   node submit-multiplier.mjs --login            (print the sign-in URL)
//
// Auth: needs a personal API token. Mint one by signing in with GitHub at
// <api-url>/account, then put it in .dev.vars as MCP_API_TOKEN (or export it).
//
// Flags:
//   --api-url <url>   override the API base (default: production)
//   --env-file <path> env file holding MCP_API_TOKEN
//   --login           print the GitHub sign-in URL and exit
//   --help            show usage
//
// Submissions go into a review queue (approved=0); a maintainer approves them
// before they appear in the live directory. The submitter handle is taken from
// the token's GitHub identity — you can't set author_github yourself.

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const DEFAULT_API = 'https://multipliers.mindcoding.institute';

const FIELD_FLAGS = {
  '--title': 'title',
  '--description': 'description',
  '--url': 'url',
  '--more-info-url': 'more_info_url',
  '--author-email': 'author_email',
  '--tags': 'tags',
};

const USAGE = `Submit a multiplier to the directory (queued for review).

Required:  --title  --description  --url
Optional:  --more-info-url  --author-email  --tags
Auth:      MCP_API_TOKEN in .dev.vars (mint one at <api-url>/account)
Flags:     --api-url <url>  --env-file <path>  --login  --help`;

function parseArgs(argv) {
  const out = { row: {}, apiUrl: process.env.MULTIPLIERS_API_URL || DEFAULT_API };
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
    else if (flag === '--login') out.login = true;
    else if (flag === '--api-url') out.apiUrl = take();
    else if (flag === '--env-file') out.envFile = take();
    else if (FIELD_FLAGS[flag]) out.row[FIELD_FLAGS[flag]] = take();
    else throw new Error(`Unknown argument: ${flag}`);
  }
  return out;
}

function parseEnvFile(path) {
  const vars = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    vars[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return vars;
}

function findUpwards(filename, startDir) {
  let dir = resolve(startDir);
  for (;;) {
    const candidate = join(dir, filename);
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function loadToken(envFile) {
  if (process.env.MCP_API_TOKEN) return process.env.MCP_API_TOKEN;
  const path = envFile ? resolve(envFile) : findUpwards('.dev.vars', process.cwd());
  if (path && existsSync(path)) {
    const token = parseEnvFile(path).MCP_API_TOKEN;
    if (token) return token;
  }
  throw new Error(
    'Missing MCP_API_TOKEN. Sign in at <api-url>/account to mint one, then add it ' +
      'to .dev.vars or export it. Run with --login to print the sign-in URL.'
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(USAGE);
    return;
  }
  if (args.login) {
    console.log(`Sign in with GitHub to mint a token:\n  ${args.apiUrl}/account`);
    console.log('Then add the token to .dev.vars as MCP_API_TOKEN.');
    return;
  }

  const row = args.row;
  const required = ['title', 'description', 'url'];
  const missing = required.filter((k) => !row[k] || !String(row[k]).trim());
  if (missing.length) {
    throw new Error(`Missing required field(s): ${missing.map((m) => '--' + m).join(', ')}\n\n${USAGE}`);
  }

  const token = loadToken(args.envFile);
  const res = await fetch(`${args.apiUrl}/api/submit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(row),
  });
  const data = await res.json().catch(() => ({}));

  if (res.status === 201) {
    console.log(`✓ submitted #${data.id} as @${data.author_github} — queued for review`);
    return;
  }
  const detail = Array.isArray(data.details) ? `: ${data.details.join(', ')}` : '';
  throw new Error(`submit failed (${res.status} ${data.error ?? ''}${detail})`);
}

main().catch((e) => {
  console.error(`submit-multiplier failed: ${e.message}`);
  process.exit(1);
});
