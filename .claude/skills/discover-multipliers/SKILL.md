---
name: discover-multipliers
description: Find, discover, search for, research, or source new mind multipliers for the Mind Coding Institute directory. Applies the five-property admission test, searches by layer, and presents candidates for approval before adding.
triggers:
  - find multipliers
  - discover multipliers
  - search for multipliers
  - research multipliers
  - source multipliers
  - look for multipliers
---
***

# discover-multipliers

Triggers when the user asks to **find**, **discover**, **search for**, **research**, or **source** new mind multipliers for the Mind Coding Institute directory.

***

## What is a Mind Multiplier?

A multiplier is a reusable, **concrete artifact** that increases the leverage of one mind. It must pass all five properties:

1. **Reusable** — you reach for it again next week
2. **Transferable** — works for someone who didn't write it
3. **Composable** — stacks with other multipliers
4. **Encodes judgment** — carries a decision you no longer have to re-make
5. **Concrete & standalone** — it's a packaged thing you can install, run, or copy (a tool, skill, harness, platform, or self-contained library), **not** a concept, methodology, technique, or article describing one — and **not** a sub-component of something already in the directory

**Litmus test:** *If you deleted it, would your future self be measurably slower or worse?*

**Concreteness gate (property 5) is the decisive filter.** A concept like "chain-of-thought" or "context engineering" can pass the first four properties yet still isn't a directory entry — it's an *article*. Ask: *would this stand on its own as an installable/usable artifact, or is it really a section of an article or a feature of something already listed?* If the latter, it belongs in the **articles repository**, not here. Add the concrete toolkit that implements a method (e.g. Spec Kit, BMAD), never the method as an idea.

A multiplier moves at least one of the three pillars — and the best ones move all three:
- **INTENT** — helps express intent more precisely
- **LEVERAGE** — more output, less friction per unit of effort
- **JUDGMENT** — encodes review, taste, and constraint so output is good, not just abundant

> Note: "multiplier" is not an established term in the wild. You are searching for the *thing* each layer is already called, then applying the admission test.

***

## The Six Layers

Search by layer — each has its own vocabulary:

| Layer | Also called | Primary pillar |
|-------|-------------|----------------|
| 1. Prompts & Patterns | prompt libraries, system prompt collections, LLM tricks | INTENT / LEVERAGE |
| 2. Skills | Claude Code skills, agent skills, `.claude/skills` | JUDGMENT / LEVERAGE |
| 3. Tools, MCPs & CLIs | MCP servers, agent tools, Claude integrations | LEVERAGE |
| 4. Harnesses & Agents | coding agents, agentic IDEs, autonomous platforms | LEVERAGE |
| 5. Workflows & Methods | dev methodologies, spec-driven, context engineering | INTENT / JUDGMENT |
| 6. Services & Platforms | AI coding SaaS, agent platforms | LEVERAGE |

***

## Discovery Sources by Layer

### Layer 1 — Prompts & Patterns
- `github.com/danielmiessler/fabric` — add **Fabric itself** as the entry; individual patterns are sub-components → articles repo, not the directory
- GitHub search: `"prompt pattern" stars:>500`
- GitHub search: `"system prompt" stars:>200 language:markdown`
- Anthropic cookbook: `github.com/anthropics/anthropic-cookbook`

### Layer 2 — Skills
- GitHub search: `"SKILL.md" path:.claude/skills`
- GitHub search: `claude code skill`
- `github.com/anthropics/skills` — Anthropic's official skill set (17 packaged skills)
- `github.com/DietrichGebert/ponytail` — canonical community skill example

### Layer 3 — Tools, MCPs & CLIs
- `github.com/modelcontextprotocol/servers` — official MCP server registry
- `mcp.so` — community MCP directory, filterable by category
- GitHub topic: `github.com/topics/mcp-server`
- GitHub search: `awesome-mcp-servers`

### Layer 4 — Harnesses & Agents
- `artificialanalysis.ai/agents/coding` — SWE-bench / Terminal-Bench leaderboard
- GitHub search: `awesome-claude-code`
- GitHub search: `awesome-llm-apps`
- Product Hunt: "AI developer tools" sorted by newest

### Layer 5 — Workflows & Methods
> Capture the **concrete toolkit** that implements a method, never the method as an idea. "Context engineering" and "spec-driven development" as write-ups are articles; Spec Kit and BMAD are the admissible artifacts.
- `github.com/github/spec-kit` — the toolkit, not the "spec-driven development" concept
- `github.com/bmadcode/BMAD-METHOD` — the framework repo
- GitHub search: `"spec-driven development"` → find the **tool** behind the post
- GitHub search: `"context engineering" stars:>200` → look for a packaged artifact, not the essay

### Layer 6 — Services & Platforms
- YC batch pages (W25, S25, W26) filtered to "developer tools" and "AI"
- Product Hunt "AI coding" category
- `there's an ai for that` / `futurepedia` directories

### Cross-layer sources (high signal)
- Hacker News: search `"claude code" workflow`, `"system prompt"`, `context engineering`
- Reddit `r/ClaudeAI`, `r/LocalLLaMA` — practitioners share raw multipliers before packaging
- X/Twitter: `claude code skill`, `CLAUDE.md`, `context engineering`, `MCP server`

***

## Discovery Workflow

Run this loop for each discovery session:

### Step 1 — Cast wide
Query 2–3 sources per layer relevant to the session's focus. Collect raw candidates (name, URL, one-line description).

### Step 2 — Apply the admission test
For each candidate ask:
- [ ] **Concrete & standalone** — a packaged artifact (not a concept/article), and not a sub-piece of something already listed?
- [ ] Reusable — would someone reach for this repeatedly?
- [ ] Transferable — does it work for someone who didn't write it?
- [ ] Composable — does it stack with other multipliers?
- [ ] Encodes judgment — does it carry a baked-in decision?

**Discard anything that fails the Concrete & standalone gate** (route it to the articles repo instead), or that fails two or more of the rest. Flag borderline cases.

### Step 3 — Tag by layer + pillar
Assign **one layer tag** (`prompt`, `skill`, `tool`, `harness`, `workflow`, `platform`) matching what the candidate *is*, plus **one pillar tag** (`INTENT`, `LEVERAGE`, `JUDGMENT`) for what it primarily moves — the directory convention is one of each.

Check available tags first:
```bash
npm run tags
```

### Step 4 — Check for duplicates
Compare candidate titles against the live directory:
```bash
npm run add-multiplier -- --title "Candidate Title" --dry-run
```
Or eyeball `https://multipliers.mindcoding.institute`.

### Step 5 — Add via skill
For each approved candidate:
```bash
npm run add-multiplier --   --title "Title"   --description "One or two sentences. What it does and why it's a multiplier."   --link "https://primary-url"   --more "https://secondary-url"   --by "@github-handle"   --tags "LAYER,PILLAR"
```

### Step 6 — Log the session
After bulk additions, log a WorkJournal entry in the `mindcoding` journal:
- What sources were searched
- How many candidates found vs admitted
- Any new tags needed (flag for `add-tag` follow-up)
- Patterns noticed (e.g. a whole new sub-layer emerging)

***

## Output format for a discovery report

When presenting discovered candidates to the user before adding, use this table format:

| # | Title | Layer | By | Pillar(s) | Admit? |
|---|-------|-------|----|-----------|--------|
| 1 | Example Skill | Skills | @author | LEVERAGE | ✅ |
| 2 | Context Engineering | Workflows | @author | INTENT | ❌ concept → articles repo |
| 3 | Fabric — Summarize Pattern | Prompts | @author | LEVERAGE | ❌ sub-piece of Fabric |

Always show the full table before running `add-multiplier` so the user can prune.

***

## What NOT to add

These fail the **Concrete & standalone** gate — most belong in the **articles repository**, not the directory:

- **Concepts, methodologies, practices, or techniques** with no concrete artifact — e.g. "chain-of-thought", "context engineering", "spec-driven development" as an *idea*. Add the toolkit that implements the method (Spec Kit, BMAD), never the method itself.
- **Sub-components of an already-listed artifact** — a single Fabric pattern when Fabric is the entry, one "pattern" lifted from a tool's docs (e.g. a subagent-delegation pattern). List the parent artifact once; the pieces are article material.
- **Generic vendor features** documented only in product docs (e.g. a `CLAUDE.md` file) — too generic to stand alone.
- One-off prompts typed and lost (not reusable)
- Tutorials or blog posts (encode knowledge, not judgment)
- Model releases or benchmarks (not a reusable artifact)
- Anything paywalled with no public interface (not transferable)
- Duplicates of existing entries (run the duplicate check)