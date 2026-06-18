// Shared env loader for the add-multiplier scripts.
//
// Resolves TURSO_DATABASE_URL + TURSO_WRITE_TOKEN, in priority order:
//   1. an explicit env file  (--env-file <path>  or  TURSO_ENV_FILE)
//   2. already-exported process.env vars (e.g. set in CI)
//   3. the nearest `.dev.vars` found by walking up from cwd, then from
//      this script's location (the repo keeps secrets in .dev.vars).
//
// Writing needs the read-WRITE token, so we resolve TURSO_WRITE_TOKEN here
// rather than the read-only one the site uses.

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REQUIRED = ['TURSO_DATABASE_URL', 'TURSO_WRITE_TOKEN'];

/** Minimal KEY="value" / KEY=value parser (same shape as .dev.vars). */
function parseEnvFile(path) {
  const vars = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    vars[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return vars;
}

/** Walk up from startDir looking for `filename`; return its path or null. */
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

export function loadWriteEnv({ envFile } = {}) {
  const explicit = envFile || process.env.TURSO_ENV_FILE;
  let fileVars = {};
  let source = 'process.env';

  if (explicit) {
    const p = resolve(explicit);
    if (!existsSync(p)) throw new Error(`env file not found: ${p}`);
    fileVars = parseEnvFile(p);
    source = p;
  } else if (!(process.env.TURSO_DATABASE_URL && process.env.TURSO_WRITE_TOKEN)) {
    const scriptDir = dirname(fileURLToPath(import.meta.url));
    const found =
      findUpwards('.dev.vars', process.cwd()) || findUpwards('.dev.vars', scriptDir);
    if (found) {
      fileVars = parseEnvFile(found);
      source = found;
    }
  }

  const env = {
    TURSO_DATABASE_URL: process.env.TURSO_DATABASE_URL || fileVars.TURSO_DATABASE_URL,
    TURSO_WRITE_TOKEN: process.env.TURSO_WRITE_TOKEN || fileVars.TURSO_WRITE_TOKEN,
  };

  const missing = REQUIRED.filter((k) => !env[k]);
  if (missing.length) {
    throw new Error(
      `Missing ${missing.join(', ')}. Add them to .dev.vars (gitignored), ` +
        `pass --env-file <path>, or export them. Source tried: ${source}`
    );
  }

  return { ...env, source };
}
