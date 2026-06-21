---
name: submit-multiplier
description: Submit a multiplier to the Mind Coding directory through the public submission API (queued for maintainer review). Use when a contributor — not a maintainer — wants to propose a tool, skill, harness, or resource for the directory. Requires a personal API token (MCP_API_TOKEN) minted by signing in with GitHub. Unlike add-multiplier, this does not need the Turso write token and does not publish directly.
---

# Submit a multiplier

Proposes a new entry to the `multipliers` directory through the public API at
`multipliers.mindcoding.institute/api/submit`. Submissions land in a **review
queue** (`approved=0`) — a maintainer approves them before they appear live.

This is the **contributor** path. If you have the Turso write token and want to
publish directly, use the **add-multiplier** skill instead.

## Auth — one-time setup

You need a personal API token:

1. Sign in with GitHub at <https://multipliers.mindcoding.institute/account>
   (or run `node scripts/submit-multiplier.mjs --login` to print the URL).
2. Copy the `mcp_…` token shown once after sign-in.
3. Put it in `.dev.vars` (gitignored) as `MCP_API_TOKEN="mcp_…"`, or export it.

The token identifies you; your GitHub handle is attached as the submitter
automatically (you can't set `author_github` yourself).

## What belongs in the directory

Only **concrete, standalone artifacts** — a tool, skill, harness, platform, MCP
connector, or self-contained prompt library you can install, run, or copy. Not
concepts, methodologies, or articles. (Same admission rule as add-multiplier.)

## Submit

```sh
node .claude/skills/submit-multiplier/scripts/submit-multiplier.mjs \
  --title "Spec Kit" \
  --description "A toolkit for spec-driven development…" \
  --url "https://github.com/github/spec-kit" \
  --more-info-url "https://github.blog/…" \   # optional
  --tags "workflow,INTENT"                     # optional but recommended
```

- **Required:** `--title`, `--description`, `--url` (http/https).
- **Optional:** `--more-info-url`, `--author-email`, `--tags`.
- **Tags:** one layer (lowercase: prompt, skill, tool, harness, workflow,
  platform) + one pillar (UPPERCASE: INTENT, LEVERAGE, JUDGMENT). The API
  rejects unknown tags.

The API validates fields, checks the tag vocabulary, and rejects duplicates of
anything already in the directory (approved or pending). On success it prints
the new submission id.

## Errors

- `401 unauthorized` — missing/invalid/revoked token. Re-mint at `/account`.
- `400 validation` / `unknown_tags` — fix the reported fields/tags.
- `409 duplicate` — that title or URL is already in the directory.
- `429 rate_limited` — too many of your submissions are awaiting review.
