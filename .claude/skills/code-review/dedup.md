---
name: dedup
description: Deduplicates code review findings across agents using file:line key with category union — merges same-line issues while preserving independent concerns
user-invocable: false
---

# Finding Deduplication

Merge code review findings from multiple agents to eliminate duplicate reporting while preserving independent concerns.

## Dedup Rules (v2)

1. **Dedup key**: `file:line` — exact line match only (no ±5 line fuzzy matching)
2. **Category union**: when two agents flag the same line, merge into one finding with combined categories (e.g., "安全 + 逻辑"). Do NOT drop one — they are two dimensions of the same root issue
3. **Primary agent**: when merging, use the highest-priority agent's risk/fix description (Priority chain: Security > Logic > Perf > Style > Test)
4. **also_flagged_by**: record which other agents flagged the same line (shown in report as "也被 X 审查标记")
5. **Kudo preservation**: Kudos are never deduped (positive reinforcement is cheap, false dedup is harmful)

## Dedup Example

| Agent | File:Line | Issue | Action |
|-------|-----------|-------|--------|
| Security | `src/login.ts:42` | SQL injection in query | **Keep as primary** |
| Logic | `src/login.ts:42` | Missing null check on query input | **Merge** — add category "逻辑", record in also_flagged_by |
| Logic | `src/login.ts:85` | Missing rollback on failure | **Keep** (unique line) |
| Perf | `src/utils.ts:10` | N+1 query in loop | **Keep** (unique line) |
| Style | `src/utils.ts:10` | Variable name too short | **Keep** (unique line — different concern, no merge) |

Note: `src/login.ts:42` becomes ONE finding with categories ["安全", "逻辑"], Security's risk/fix, also_flagged_by: ["logic"]. `src/utils.ts:10` stays as TWO separate findings because the concerns are genuinely independent (performance vs naming).

## Process

For each finding from all agent outputs:
1. Normalize: extract `file`, `line`, `severity`, `category`, `issue`, `risk`, `fix`/`suggestion`
2. Build dedup key: `{file}:{line}`
3. If key doesn't exist → add as new entry, track `primary_agent` priority
4. If key exists:
   - Merge categories: append current category to the entry's category list
   - If current agent priority > stored primary_agent priority → replace risk/fix with current agent's
   - Add current agent to `also_flagged_by` list
5. Skip merge only if the two findings are clearly different concerns on the same line (rare — use judgment: N+1 perf issue vs variable naming are different; SQL injection vs missing null check are the same)

## Agent Priority Chain

| Priority | Agent | Dimension |
|----------|-------|-----------|
| 1 (highest) | security-reviewer | Security |
| 2 | logic-reviewer | Logic |
| 3 | perf-reviewer | Performance |
| 4 | style-reviewer | Style |
| 5 (lowest) | test-reviewer | Test |

After dedup, recount Critical/Warning/Kudo totals. These deduped counts feed into report generation.
