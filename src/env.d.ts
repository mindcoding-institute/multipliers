/// <reference types="astro/client" />

interface Env {
  /** libsql:// connection URL for the Turso database. */
  TURSO_DATABASE_URL: string;
  /** Read-only Turso auth token. */
  TURSO_AUTH_TOKEN: string;
}

type Runtime = import('@astrojs/cloudflare').Runtime<Env>;

declare namespace App {
  interface Locals extends Runtime {}
}
