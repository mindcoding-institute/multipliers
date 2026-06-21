/// <reference types="astro/client" />

interface Env {
  /** libsql:// connection URL for the Turso database. */
  TURSO_DATABASE_URL: string;
  /** Read-only Turso token — used by the listing. */
  TURSO_READ_TOKEN: string;
  /** Read-write Turso token — used by the submission API + OAuth flow. */
  TURSO_WRITE_TOKEN: string;
  /** GitHub OAuth App client id — for contributor sign-in / token minting. */
  GITHUB_CLIENT_ID: string;
  /** GitHub OAuth App client secret. */
  GITHUB_CLIENT_SECRET: string;
  /** HMAC key signing the OAuth state cookie and the session cookie. */
  TOKEN_SIGNING_SECRET: string;
}

type Runtime = import('@astrojs/cloudflare').Runtime<Env>;

declare namespace App {
  interface Locals extends Runtime {}
}
