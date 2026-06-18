/// <reference types="astro/client" />

interface Env {
  /** libsql:// connection URL for the Turso database. */
  TURSO_DATABASE_URL: string;
  /** Read-only Turso token — used by the listing. */
  TURSO_READ_TOKEN: string;
  /** Read-write Turso token — for the future submission flow. */
  TURSO_WRITE_TOKEN: string;
}

type Runtime = import('@astrojs/cloudflare').Runtime<Env>;

declare namespace App {
  interface Locals extends Runtime {}
}
