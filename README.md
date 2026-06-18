# Mind Coding — Multipliers

A small standalone app that lists **multipliers** — the reusable artifacts,
practices, and methods that raise what one mind can build. Companion to
[mindcoding.institute](https://mindcoding.institute).

For now it's a read-only listing backed by a [Turso](https://turso.tech)
(libSQL) database. Submission of new multipliers will come later.

## Stack

- **[Astro 5](https://astro.build)** in SSR mode (`output: 'server'`)
- **[@astrojs/cloudflare](https://docs.astro.build/en/guides/integrations-guide/cloudflare/)** — runs on Cloudflare Pages Functions
- **[@libsql/client](https://github.com/tursodatabase/libsql-client-ts)** (`/web` build) — queries Turso over HTTP at request time
- **[WebTUI](https://webtui.ic.gd)** + the shared mindcoding.institute terminal theme

The page is server-rendered on each request, so the list always reflects the
database with no rebuild.

## Database

```sql
CREATE TABLE multipliers (
  id            integer PRIMARY KEY AUTOINCREMENT,
  title         text NOT NULL UNIQUE,
  description   text NOT NULL,
  url           text NOT NULL UNIQUE,
  more_info_url text,
  author_github text,
  author_email  text
);
```

## Local development

1. Install deps:
   ```sh
   npm install
   ```
2. Create `.dev.vars` from the example and fill in the Turso tokens:
   ```sh
   cp .dev.vars.example .dev.vars
   # edit .dev.vars
   ```
3. Run the dev server:
   ```sh
   npm run dev
   ```

`astro dev` reads `.dev.vars` through the Cloudflare platform proxy, so
`Astro.locals.runtime.env` works the same locally as in production.

## Environment variables

| Name                 | Purpose                                          |
| -------------------- | ------------------------------------------------ |
| `TURSO_DATABASE_URL` | `libsql://…turso.io` connection URL              |
| `TURSO_READ_TOKEN`   | **Read-only** Turso token (used by the listing)  |
| `TURSO_WRITE_TOKEN`  | **Read-write** Turso token (future submit flow)  |

Locally these live in `.dev.vars` (gitignored). In production set them as
Cloudflare Pages secrets:

```sh
npx wrangler pages secret put TURSO_DATABASE_URL --project-name mindcoding-multipliers
npx wrangler pages secret put TURSO_READ_TOKEN   --project-name mindcoding-multipliers
npx wrangler pages secret put TURSO_WRITE_TOKEN  --project-name mindcoding-multipliers
```

## Deploy

```sh
npm run deploy   # astro build && wrangler pages deploy dist
```
