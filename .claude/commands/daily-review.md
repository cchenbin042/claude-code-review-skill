---
description: Daily code review — collects today's changes, runs parallel review agents, generates an HTML report
argument-hint: [today | N days | branch | PR #N] [--leader]
model: sonnet
allowed-tools:
  - AskUserQuestion
  - Agent
  - Write
  - Read
  - Bash(mkdir:*)
  - Bash(date:*)
---

# Daily Code Review Command

Collect changes → pre-filter → parallel review → dedup → generate HTML report. Zero external dependencies (no Python/Node required).

## Rules

1. Final output is ALWAYS `reports/daily-review-YYYY-MM-DD.html`. Never .md.
2. Use the Write tool to create the file. Do NOT output report content in chat.
3. The HTML template at `.claude/skills/code-review/report-template-v2.html` is the ONLY valid output structure.

## Workflow

### Step 0: Verify git repo and detect mode

Check if current directory is a git repository. If not, tell user and stop.

Detect mode from user input:
- `--leader` present → **Leader mode**: 5 agents (security/logic/style/perf at full detail + test-reviewer at module-level with haiku)
- No `--leader` → **Developer mode**: all 5 agents at full detail

### Step 1: Ask scope

Use AskUserQuestion to let user choose (max 4 options per tool limit):
- "Uncommitted changes" (working tree, before commit — developer's highest-frequency choice)
- "Today's changes" (committed today — team lead's daily review)
- "Last N days" (specify number of days)
- "Branch/PR comparison" (branch diff or specific PR/MR)

### Step 2: Collect changes

First, compute the dynamic maxTurns based on file count:

Let `fileCount` = number of files in the diff scope (from git stat).
Let `turns` = fileCount < 20 ? 5 : fileCount < 50 ? 8 : 12

Launch Agent diff-collector (model: haiku, maxTurns: turns) with prompt:
"Collect all code changes for: [scope]. Apply pre-filtering: exclude node_modules/.git/dist/build artifacts, binary files, trivial formatting/comment-only changes. If >50 files, switch to summary mode. Include full diffs with language detection per file."

If 0 files returned after filtering, inform user and stop.

Store the complete diff-collector output as `diffOutput`. This will be embedded into each agent prompt to eliminate redundant file reads across agents.

### Step 2.5: Prepare unified diff context

Before launching review agents, prepare the diff context to embed in prompts. This eliminates the N×M cost of agents independently reading the same files.

Let `diffSize` = character count of `diffOutput`.

**Small diff** (diffSize ≤ 15000 chars): Embed ALL diffs for all agents.
- Agent prompt prefix = the full `diffOutput`, followed by a separator and the review instruction.

**Medium diff** (15000 < diffSize ≤ 40000 chars): Embed the summary + file list table + diffs for high-risk files only.
- Extract from `diffOutput`: the "Change Summary" section and the "Files for Review" table.
- Also include full diffs for files matching high-risk paths: `auth/`, `payment/`, `api/`, `middleware/`, `config/`, `db/`, `crypto/`, `token/`, `secret/`.
- Agent prompt prefix = summary + file table + high-risk diffs. Agents will Read other files as needed.

**Large diff** (diffSize > 40000 chars): Embed only the summary + file list table.
- Agent prompt prefix = summary + file table. Agents will Read files individually as needed.

The prefix heading for each tier:
- Small: `## Diff Context (Pre-loaded — do NOT re-read files listed below)`
- Medium: `## Diff Context (Summary + High-Risk — Read other files as needed)`
- Large: `## Diff Context (File Index — Read files as needed)`

### Step 3: Parallel review

**CRITICAL — ALL agents MUST be launched in a SINGLE message to run in parallel.** Do NOT launch agents one by one.

**Leader mode** — single message with exactly 5 Agent calls. Security stays on sonnet (can't miss vulnerabilities); logic/style/perf downgrade to haiku for cost savings (~60% token reduction).

Build `promptPrefix` from Step 2.5 (the diff context tier). Each agent prompt = `promptPrefix` + "\n\n---\n\n" + the dimension-specific instruction below.

1. Agent security-reviewer (model: sonnet): "{promptPrefix}\n\n---\n\n[mode: leader] Review for security: injection, auth, data exposure, secrets, crypto. Focus on Critical findings only — skip Warning-level issues unless they represent real risk."
2. Agent logic-reviewer (model: haiku): "{promptPrefix}\n\n---\n\n[mode: leader] Review for logic: edge cases, error handling, state consistency, concurrency. Focus on Critical findings only — skip style-adjacent warnings."
3. Agent style-reviewer (model: haiku): "{promptPrefix}\n\n---\n\n[mode: leader] Review for style: naming, structure, duplication, language-specific patterns. Report only Warning-level issues — skip nitpicks."
4. Agent perf-reviewer (model: haiku): "{promptPrefix}\n\n---\n\n[mode: leader] Review for performance: N+1 queries, missing timeouts, unbounded collections, blocking I/O. Focus on patterns with measurable impact at scale."
5. Agent test-reviewer (model: haiku): "{promptPrefix}\n\n---\n\n[mode: leader] Module-level test coverage audit. Identify zero-coverage high-risk modules only (auth/payment/api/db/middleware). Do NOT inspect per-function test quality."

**Developer mode** — single message with 5 Agent calls (all model: sonnet):

Build `promptPrefix` from Step 2.5 (the diff context tier). Each agent prompt = `promptPrefix` + "\n\n---\n\n" + the dimension-specific instruction below.

1. Agent security-reviewer: "{promptPrefix}\n\n---\n\nReview for security: injection, auth, data exposure, secrets, crypto."
2. Agent logic-reviewer: "{promptPrefix}\n\n---\n\nReview for logic: edge cases, error handling, state, concurrency."
3. Agent style-reviewer: "{promptPrefix}\n\n---\n\nReview for style: naming, structure, duplication, language-specific patterns."
4. Agent perf-reviewer: "{promptPrefix}\n\n---\n\nReview for performance: N+1, memory, blocking I/O, caching, complexity."
5. Agent test-reviewer: "{promptPrefix}\n\n---\n\n[mode: developer] Review for testing: test presence, quality, isolation, coverage gaps, flakiness."

Wait for all launched agents to complete before proceeding.

#### Agent failure tolerance

If any agent fails (error, timeout, no output, or unparseable result), do NOT abort the entire review. Handle gracefully:

1. **Mark the dimension as failed**: record `status: "failed"` for that agent's dimension (security/logic/style/perf/test)
2. **Continue with remaining agents**: dedup and report only the successful agents' findings
3. **Generate a partial report**: the report is still valuable even with one dimension missing
4. **Include the error in the dimension detail**: in `[SECURITY_DETAIL]` etc., if the agent failed, use: `<p class="dimension-error">⚠ 该维度审查未能完成 — {error reason if available}</p>`
5. **Coverage bar reflects the failure**: the failed dimension shows ✗ in the coverage indicator

If ALL agents fail, inform the user with the error details and stop — do not generate an empty report.

Track agent status per dimension in a simple map:

| Dimension | Agent | Status |
|-----------|-------|--------|
| security | security-reviewer | ok / failed / truncated |
| logic | logic-reviewer | ok / failed / truncated |
| style | style-reviewer | ok / failed / truncated |
| performance | perf-reviewer | ok / failed / truncated |
| test | test-reviewer | ok / failed / truncated |

An agent is "truncated" if it hit maxTurns without producing a JSON block (still useful — parse markdown fallback). An agent is "failed" if it errored or produced no usable output at all.

### Step 3.5: Deduplicate findings

Apply the deduplication algorithm defined in `.claude/skills/code-review/dedup.md`.

1. Read `dedup.md` for the full dedup rules, priority chain, and merge logic
2. Apply the Process from dedup.md against all findings from all agent JSON outputs
3. After dedup, recount Critical/Warning/Kudo totals

Summary of dedup key rules:
- Key = `file:line` (exact match only)
- Same line → merge categories, keep highest-priority agent's risk/fix
- Kudos never deduped
- Priority: Security > Logic > Perf > Style > Test

### Step 4: Generate HTML report

Follow the report generation workflow defined in `.claude/skills/code-review/report-builder.md`.

1. Read `report-builder.md` for the complete report generation process
2. Execute Steps 1-9 from report-builder.md:
   - Get date, create directory
   - Read the HTML template
   - Parse findings, generate finding cards
   - Build replacement map
   - Generate coverage bar, leader-only sections (executive summary, module risk, collapsible warnings)
   - Write the final HTML
   - Update SHA cache

Pass the following context to the report builder:
- `mode`: "leader" or "developer"
- `dedupedFindings`: deduped findings from Step 3.5
- `agentStatusMap`: per-dimension status from Step 3 failure tolerance
- `diffSummary`: all stats from diff-collector output
- `agentOutputs`: raw markdown from each successful agent
- `cacheHitCount`: number of files skipped via SHA cache

## Output

After the file is written, tell the user only:
```
审查完成。[X] 严重问题, [Y] 建议改进, [Z] 亮点。缓存命中: C 文件。
报告: reports/daily-review-[DATE].html
```

Where C is the number of files skipped via SHA cache.
