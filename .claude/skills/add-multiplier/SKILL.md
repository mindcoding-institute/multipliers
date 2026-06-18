---
name: add-multiplier
description: Add a new entry to the Mind Coding multipliers directory (the Turso/libSQL `multipliers` table). Use when asked to add, submit, insert, or register a multiplier, tool, skill, or resource into the directory/database. Handles tag validation and duplicate checks; needs the write token in .dev.vars.
---

# Add a multiplier

Adds a row to the `multipliers` table in Turso. The public listing
(multipliers.mindcoding.institute) reads this table at request time, so a new
row appears live with no redeploy.

## Prerequisites

- Run from the repo root (`multipliers/`), so `node_modules` (for
  `@libsql/client`) and `.dev.vars` resolve.
- **Write token**: the scripts read `TURSO_DATABASE_URL` + `TURSO_WRITE_TOKEN`
  from `.dev.vars` (gitignored). They fall back to `process.env`, or a path
  passed via `--env-file`. The read-only token used by the site is **not**
  enough — writing needs `TURSO_WRITE_TOKEN`. If it's missing, copy
  `.dev.vars.example` → `.dev.vars` and fill it in.

## Data model

`multipliers(id, title UNIQUE, description, url UNIQUE, more_info_url,
author_github, author_email, tags)` — `title`, `description`, `url` are
required; the rest are optional. `tags` is a comma-delimited string.

Tags are **case-sensitive** and drive the site's filter, which only offers tags
that exist in the `tags` table:

- **layer** tags — lowercase, singular: `prompt`, `skill`, `tool`, `harness`,
  `workflow`, `platform`
- **pillar** tags — UPPERCASE: `INTENT`, `LEVERAGE`, `JUDGMENT`

Convention: each multiplier carries **one layer + one pillar** tag, e.g.
`workflow,INTENT`.

## Steps

1. **See the vocabulary** (and current usage), then pick one layer + one pillar:

   ```sh
   node .claude/skills/add-multiplier/scripts/check-tags.mjs
   ```

   To validate a specific set before inserting (exits non-zero if any is
   unknown — catches casing mistakes):

   ```sh
   node .claude/skills/add-multiplier/scripts/check-tags.mjs workflow,INTENT
   ```

2. **Add the row.** Quote every value; only `--title`, `--description`,
   `--url` are required:

   ```sh
   node .claude/skills/add-multiplier/scripts/add-multiplier.mjs \
     --title "GitHub Spec Kit" \
     --description "A toolkit for spec-driven development that makes the spec an executable artifact." \
     --url "https://github.com/github/spec-kit" \
     --more-info-url "https://github.blog/…" \
     --author-github "github" \
     --tags "workflow,INTENT"
   ```

   The script: validates required fields and URL shape; rejects unknown tags
   (override with `--allow-unknown-tags`); refuses a duplicate `title`/`url`
   unless you pass `--update` (which upserts by title); then prints the new row
   id and stored tags.

3. **Confirm.** Re-run `check-tags.mjs` (usage counts reflect the new row), or
   check the live listing / a filtered view such as
   `https://multipliers.mindcoding.institute/?tags=INTENT`.

## Notes

- `author_email` is only displayed when there's no `author_github`.
- To correct an existing entry, re-run step 2 with the same `--title` plus
  `--update`.
- Both scripts accept `--env-file <path>` if your secrets live elsewhere.
