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
3. The HTML template at `.claude/skills/code-review/report-template.html` is the ONLY valid output structure.

## Workflow

### Step 0: Verify git repo and detect mode

Check if current directory is a git repository. If not, tell user and stop.

Detect mode from user input:
- `--leader` present → **Leader mode**: 4 core agents (security/logic/style/perf)，跳过 test-reviewer
- No `--leader` → **Developer mode**: all 5 agents at full detail

### Step 1: Ask scope

Use AskUserQuestion to let user choose (max 4 options per tool limit):
- "Uncommitted changes" (working tree, before commit — developer's highest-frequency choice)
- "Today's changes" (committed today — team lead's daily review)
- "Last N days" (specify number of days)
- "Branch/PR comparison" (branch diff or specific PR/MR)

### Step 2: Collect changes

Launch Agent diff-collector (model: haiku) with prompt:
"Collect all code changes for: [scope]. Apply pre-filtering: exclude node_modules/.git/dist/build artifacts, binary files, trivial formatting/comment-only changes. If >50 files, switch to summary mode. Include full diffs with language detection per file."

If 0 files returned after filtering, inform user and stop.

### Step 3: Parallel review

**CRITICAL — ALL agents MUST be launched in a SINGLE message to run in parallel.** Do NOT launch agents one by one.

**Leader mode** — single message with exactly 4 Agent calls (all model: sonnet):
1. Agent security-reviewer: "Review for security: injection, auth, data exposure, secrets, crypto."
2. Agent logic-reviewer: "Review for logic: edge cases, error handling, state, concurrency."
3. Agent style-reviewer: "Review for style: naming, structure, duplication, language-specific patterns."
4. Agent perf-reviewer: "Review for performance: N+1, memory, blocking I/O, caching, complexity."

**DO NOT launch test-reviewer or any general-purpose agent for testing in leader mode.** Leader 只关心核心 4 维度。测试维度由模块风险分布表覆盖。

**Developer mode** — single message with 5 Agent calls (all model: sonnet):
1. Agent security-reviewer: "Review for security: injection, auth, data exposure, secrets, crypto."
2. Agent logic-reviewer: "Review for logic: edge cases, error handling, state, concurrency."
3. Agent style-reviewer: "Review for style: naming, structure, duplication, language-specific patterns."
4. Agent perf-reviewer: "Review for performance: N+1, memory, blocking I/O, caching, complexity."
5. Agent test-reviewer: "[mode: developer] Review for testing: test presence, quality, isolation, coverage gaps, flakiness."

Wait for all launched agents to complete before proceeding.

### Step 3.5: Deduplicate findings

Before generating the report, deduplicate findings across all agents to avoid the same issue being reported multiple times.

#### Dedup rules (v2)

1. **Dedup key**: `file:line` — exact line match only (no ±5 line fuzzy matching)
2. **Category union**: when two agents flag the same line, merge into one finding with combined categories (e.g., "安全 + 逻辑"). Do NOT drop one — they are two dimensions of the same root issue
3. **Primary agent**: when merging, use the highest-priority agent's risk/fix description (Priority chain: Security > Logic > Perf > Style > Test)
4. **also_flagged_by**: record which other agents flagged the same line (shown in report as "也被 X 审查标记")
5. **Kudo preservation**: Kudos are never deduped (positive reinforcement is cheap, false dedup is harmful)

#### Dedup example (v2)

| Agent | File:Line | Issue | Action |
|-------|-----------|-------|--------|
| Security | `src/login.ts:42` | SQL injection in query | **Keep as primary** |
| Logic | `src/login.ts:42` | Missing null check on query input | **Merge** — add category "逻辑", record in also_flagged_by |
| Logic | `src/login.ts:85` | Missing rollback on failure | **Keep** (unique line) |
| Perf | `src/utils.ts:10` | N+1 query in loop | **Keep** (unique line) |
| Style | `src/utils.ts:10` | Variable name too short | **Keep** (unique line — different concern, no merge) |

Note: `src/login.ts:42` becomes ONE finding with categories ["安全", "逻辑"], Security's risk/fix, also_flagged_by: ["logic"]. `src/utils.ts:10` stays as TWO separate findings because the concerns are genuinely independent (performance vs naming).

#### Process (v2)

For each finding from all agent outputs:
1. Normalize: extract `file`, `line`, `severity`, `category`, `issue`, `risk`, `fix`/`suggestion`
2. Build dedup key: `{file}:{line}`
3. If key doesn't exist → add as new entry, track `primary_agent` priority
4. If key exists:
   - Merge categories: append current category to the entry's category list
   - If current agent priority > stored primary_agent priority → replace risk/fix with current agent's
   - Add current agent to `also_flagged_by` list
5. Skip merge only if the two findings are clearly different concerns on the same line (rare — use judgment: N+1 perf issue vs variable naming are different; SQL injection vs missing null check are the same)

After dedup, recount Critical/Warning/Kudo totals. The deduped counts feed into Step 4.

### Step 4: Generate HTML report

**No external scripts needed — generate the HTML directly.**

The report structure differs by mode.

#### Leader Mode Report Structure

```
Hero → Executive Summary → Stats → Overview → Module Risk → Critical → Warnings (collapsible) → Dimensions → Actions
```

**Developer Mode Report Structure** (current):

```
Hero → Stats → Overview → Critical → Warnings → Kudos → Dimensions → Actions
```

Key differences for Leader mode:
- **Executive Summary**: risk level badge (low/medium/high) + top-line stats, placed right after Hero
- **Module Risk Table**: per-module breakdown, placed before Critical findings
- **Warnings collapsed by default**: Leader doesn't need every naming suggestion; expandable on click
- **Test dimension omitted**: Leader 模式不运行 test-reviewer，`[TEST_DETAIL]` 替换为空字符串
- **Executive Summary / Module Risk placeholders**: empty in developer mode

#### 4a. Get date and create directory

```bash
echo "DATE=$(date +%Y-%m-%d)" && echo "TIME=$(date +%H:%M)" && mkdir -p reports
```

#### 4b. Read the template

Use Read to load `.claude/skills/code-review/report-template.html`.

#### 4c. Parse findings from agent outputs

Extract findings from each agent's output. Each agent returns markdown tables with severity, file, issue, and detail. Convert each finding into the HTML structure defined in the template:

**Critical finding HTML:**
```html
<div class="finding finding-critical">
<div class="finding-top">
<span class="finding-badge badge-critical">严重</span>
<span class="finding-category category-security">安全</span>
<!-- For merged findings, add extra category tags: -->
<!-- <span class="finding-category category-logic">逻辑</span> -->
<span class="finding-file">{file}:{line}</span>
</div>
<div class="finding-issue">{issue}</div>
<div class="finding-detail"><strong>风险</strong> &mdash; {risk}</div>
<div class="finding-detail"><strong>修复</strong> &mdash; {fix}</div>
<!-- If merged from multiple agents: -->
<!-- <div class="finding-detail"><strong>也被</strong> logic-reviewer, style-reviewer 标记</div> -->
</div>
```

**Warning finding HTML:**
```html
<div class="finding finding-warning">
<div class="finding-top">
<span class="finding-badge badge-warning">建议</span>
<span class="finding-category category-logic">逻辑</span>
<!-- For merged findings, add extra category tags -->
<span class="finding-file">{file}:{line}</span>
</div>
<div class="finding-issue">{issue}</div>
<div class="finding-detail"><strong>建议</strong> &mdash; {suggestion}</div>
<!-- If merged from multiple agents: -->
<!-- <div class="finding-detail"><strong>也被</strong> perf-reviewer 标记</div> -->
</div>
```

**Kudo finding HTML:**
```html
<div class="finding finding-kudo">
<div class="finding-top">
<span class="finding-badge badge-kudo">亮点</span>
<span class="finding-category category-{category_lower}">{category_cn}</span>
<span class="finding-file">{file}:{line}</span>
</div>
<div class="finding-issue">{issue}</div>
</div>
```

Category mapping (EN → CN → CSS class):
- Security → 安全 → category-security
- Logic → 逻辑 → category-logic
- Style → 规范 → category-style
- Performance → 性能 → category-performance (or category-perf)
- Test → 测试 → category-test

#### 4d. Count totals and build replacement map

Count critical/warning/kudo findings from all agents (after dedup). Build these replacements:

| Placeholder | Value |
|-------------|-------|
| `[MODE_CLASS]` | `mode-leader` if --leader, else `mode-developer` |
| `[REPORT_DATE]` | YYYY-MM-DD |
| `[REVIEW_TIME]` | HH:MM |
| `[SCOPE]` | User-chosen scope + mode label: "今日变更" or "今日变更 (Leader)" |
| `[FILE_COUNT]` | Filtered file count (files for review, excluding filtered) from diff-collector summary |
| `[ADDED_LINES]` | From diff-collector summary |
| `[DELETED_LINES]` | From diff-collector summary |
| `[CONTRIBUTORS]` | From diff-collector summary |
| `[LANGUAGES]` | From diff-collector summary |
| `[PLATFORM]` | GitHub / GitLab / Git |
| `[CRITICAL_COUNT]` | Total criticals (deduped) |
| `[WARNING_COUNT]` | Total warnings (deduped) |
| `[KUDO_COUNT]` | Total kudos (deduped) |
| `[EXECUTIVE_SUMMARY]` | Leader: executive summary HTML. Developer: empty string |
| `[MODULE_RISK_TABLE]` | Leader: module risk table HTML. Developer: empty string |
| `[CRITICAL_SECTION]` | Generated critical HTML or `<div class="section-empty">未发现严重问题</div>` |
| `[WARNING_SECTION]` | Developer: full warning list. Leader: collapsible wrapper + warning list |
| `[KUDO_SECTION]` | Generated kudo HTML or `<div class="section-empty">本日未发现特别亮点</div>` |
| `[SECURITY_DETAIL]` | `<p>` + security agent full output + `</p>` |
| `[LOGIC_DETAIL]` | `<p>` + logic agent full output + `</p>` |
| `[STYLE_DETAIL]` | `<p>` + style agent full output + `</p>` |
| `[PERF_DETAIL]` | `<p>` + perf agent full output + `</p>` |
| `[TEST_DETAIL]` | Developer: `<p>` + test agent full output + `</p>`. Leader: empty string |
| `[ACTION_ITEMS]` | Action items from critical findings, or empty-state HTML |

##### Leader: Executive Summary

In leader mode, generate an executive summary card placed at `[EXECUTIVE_SUMMARY]`:

```html
<div class="exec-summary">
  <div class="exec-card">
    <div class="exec-card-header">
      <span class="exec-risk-badge {low|medium|high}">{风险较低|需要关注|风险较高}</span>
      <span class="exec-risk-text">{一句话风险概述}</span>
    </div>
    <div class="exec-card-stats">
      <div class="exec-stat">
        <div class="exec-stat-num">[CRITICAL_COUNT]</div>
        <div class="exec-stat-label">严重问题</div>
      </div>
      <div class="exec-stat">
        <div class="exec-stat-num">{affected_module_count}</div>
        <div class="exec-stat-label">受影响模块</div>
      </div>
      <div class="exec-stat">
        <div class="exec-stat-num">{author_count}</div>
        <div class="exec-stat-label">涉及成员</div>
      </div>
    </div>
  </div>
</div>
```

Risk level logic:
- **high** (`exec-risk-badge high`): Critical count > 0 → "建议优先处理严重问题后再合并"
- **medium** (`exec-risk-badge medium`): Critical = 0, Warning > 5 → "无严重问题，存在改进空间"
- **low** (`exec-risk-badge low`): Critical = 0, Warning ≤ 5 → "整体质量良好，无显著风险"

##### Leader: Module Risk Table

Group all findings by module (directory prefix like `src/auth/`, `src/api/`, etc.):

```html
<section class="module-risk">
  <div class="section-header">
    <h2>模块风险分布</h2>
  </div>
  <table class="module-risk-table">
    <thead>
      <tr><th>模块</th><th>严重</th><th>建议</th><th>风险分布</th></tr>
    </thead>
    <tbody>
      <tr>
        <td class="module-name">src/auth/</td>
        <td>2</td>
        <td>3</td>
        <td>
          <div class="module-risk-bar">
            <span class="module-risk-bar-seg critical" style="flex:2"></span>
            <span class="module-risk-bar-seg warning" style="flex:3"></span>
            <span class="module-risk-bar-seg clean" style="flex:5"></span>
          </div>
        </td>
      </tr>
      <!-- more rows -->
    </tbody>
  </table>
</section>
```

Use `[MODULE_RISK_TABLE]` for this. In developer mode, replace with empty string.

The bar segment `flex` values should reflect the proportion: `flex:{critical_count}` / `flex:{warning_count}` / `flex:{clean_count}` where clean_count = total files in module - critical - warning (min 1).

##### Leader: Collapsible Warnings

In leader mode, wrap the warning list in a collapsible container:

```html
<div class="warning-collapsible">
  <input type="checkbox" id="warning-toggle" class="warning-toggle">
  <label for="warning-toggle" class="warning-toggle-label">展开建议改进 ([WARNING_COUNT] 项)</label>
  <div class="warning-list">
    {warning finding HTML cards}
  </div>
</div>
```

In developer mode, the warning cards render directly without the collapsible wrapper.

For `[ACTION_ITEMS]`, generate from critical findings:
```html
<ul class="action-list">
<li class="action-item"><span class="action-check"></span><span class="action-author">@author</span><span class="action-desc">Fix: {issue}</span><span class="action-file">{file}:{line}</span></li>
</ul>
```

#### 4e. Perform replacements and write

Replace all `[PLACEHOLDER]` strings in the template with their values, then clean any remaining `[UNUSED_PLACEHOLDER]` with empty string.

Use the Write tool to save the result to `reports/daily-review-[DATE].html`.

#### 4f. Update SHA cache (NEW)

After the report is written, update the review cache so future runs can skip unchanged files:

1. Read `.claude/code-review-cache.json` (create empty `{}` if not found)
2. For each file from the diff-collector summary that was reviewed (not cached, not filtered):
   - key = file path, value = `{ "sha": "<sha from collector>", "result": "<clean|had_critical>", "reviewed_at": "<YYYY-MM-DD>" }`
   - result = "had_critical" if any Critical finding references this file, otherwise "clean"
3. For files marked `[cached — skipped]` in the collector output, keep existing cache entries (they were already clean)
4. Remove entries older than 7 days (compare `reviewed_at` to today)
5. Write the updated JSON back to `.claude/code-review-cache.json`

Cache file lives at `.claude/code-review-cache.json` in the project root. Add it to `.gitignore` if not already present. The cache is a local optimization — never committed.

## Output

After the file is written, tell the user only:
```
审查完成。[X] 严重问题, [Y] 建议改进, [Z] 亮点。缓存命中: C 文件。
报告: reports/daily-review-[DATE].html
```

Where C is the number of files skipped via SHA cache.
