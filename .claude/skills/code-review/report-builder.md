---
name: report-builder
description: Generates the daily code review HTML report from deduped findings — placeholder replacement, finding cards, coverage bar, mode-specific sections (leader/developer)
user-invocable: false
---

# Report Builder

Generate the final HTML report from deduped review findings. Zero external dependencies — uses Write tool directly.

## Inputs

You receive:
- `mode`: "leader" or "developer"
- `dedupedFindings`: array of deduped finding objects
- `agentStatusMap`: per-dimension status (ok/truncated/failed)
- `diffSummary`: stats from diff-collector (file count, +/- lines, contributors, languages, platform, scope, cache hits)
- `agentOutputs`: raw markdown output from each agent (for dimension detail sections)

## Report Structure by Mode

**Leader Mode**: Hero → Executive Summary → Stats → Overview → Coverage Bar → Module Risk → Critical → Warnings (collapsible) → Dimensions → Actions

**Developer Mode**: Hero → Stats → Overview → Coverage Bar → Critical → Warnings → Kudos → Dimensions → Actions

### Key differences for Leader mode

- **Executive Summary**: risk level badge (low/medium/high) + top-line stats, placed right after Hero
- **Module Risk Table**: per-module breakdown, placed before Critical findings
- **Warnings collapsed by default**: expandable on click
- **Test dimension**: module-level coverage summary from haiku test-reviewer
- **Coverage Bar**: all modes show per-dimension coverage status
- **Executive Summary / Module Risk placeholders**: empty in developer mode

## Step 1: Get date and create directory

```bash
echo "DATE=$(date +%Y-%m-%d)" && echo "TIME=$(date +%H:%M)" && mkdir -p reports
```

## Step 2: Read the template

Use Read to load `.claude/skills/code-review/report-template-v2.html`.

## Step 3: Parse findings from agent outputs

Each agent output contains a JSON block (```json ... ```) at the end. **Prefer parsing JSON** — it's structured and reliable. Fall back to markdown table parsing if JSON is missing or malformed.

### JSON parsing (preferred)

Extract the JSON block from each agent's output. The schema for each finding:

```json
{
  "dimension": "security",
  "findings": [
    {
      "severity": "critical",
      "categories": ["security", "logic"],
      "file": "src/auth/login.ts",
      "line": 42,
      "sha": "a1b2c3d4...",
      "issue": "Password comparison uses ===",
      "risk": "Timing side-channel enables user enumeration",
      "fix": "Use crypto.timingSafeEqual()",
      "also_flagged_by": ["logic"]
    }
  ]
}
```

### Markdown parsing (fallback)

If JSON is missing/unparseable, parse the markdown tables: severity, file, issue, and detail.

## Step 4: Generate finding HTML cards

### Critical finding HTML
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

### Warning finding HTML
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

### Kudo finding HTML
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

### Category mapping (EN → CN → CSS class)
- Security → 安全 → category-security
- Logic → 逻辑 → category-logic
- Style → 规范 → category-style
- Performance → 性能 → category-performance (or category-perf)
- Test → 测试 → category-test

## Step 5: Build replacement map

| Placeholder | Value |
|-------------|-------|
| `[MODE_CLASS]` | `mode-leader` if leader, else `mode-developer` |
| `[MODE_BADGE_CLASS]` | `lead` if leader, else `dev` |
| `[MODE_LABEL]` | `LEADER` if leader, else `DEVELOPER` |
| `[REPORT_DATE]` | YYYY-MM-DD |
| `[REVIEW_TIME]` | HH:MM |
| `[SCOPE]` | Scope + mode label: "今日变更" or "今日变更 (Leader)" |
| `[FILE_COUNT]` | Filtered file count from diff-collector summary |
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
| `[SECURITY_DETAIL]` | `<p>` + security agent output + `</p>`. If failed: `<p class="dimension-error">⚠ ...</p>` |
| `[LOGIC_DETAIL]` | `<p>` + logic agent output + `</p>`. If failed: `<p class="dimension-error">⚠ ...</p>` |
| `[STYLE_DETAIL]` | `<p>` + style agent output + `</p>`. If failed: `<p class="dimension-error">⚠ ...</p>` |
| `[PERF_DETAIL]` | `<p>` + perf agent output + `</p>`. If failed: `<p class="dimension-error">⚠ ...</p>` |
| `[TEST_DETAIL]` | Developer: `<p>` + test agent output + `</p>`. Leader: `<p>` + module coverage summary + `</p>`. If failed: `<p class="dimension-error">⚠ ...</p>` |
| `[COVERAGE_BAR]` | Coverage indicator showing status of each dimension |
| `[ACTION_ITEMS]` | Action items from critical findings, or empty-state HTML |

## Step 6: Coverage Bar

Generate a coverage indicator that shows the status of each review dimension:

```html
<div class="coverage-bar">
  <div class="cov-item {security_status}">&#x1F512; 安全 {security_icon}</div>
  <div class="cov-item {logic_status}">&#x2699; 逻辑 {logic_icon}</div>
  <div class="cov-item {style_status}">&#x270E; 规范 {style_icon}</div>
  <div class="cov-item {perf_status}">&#x26A1; 性能 {perf_icon}</div>
  <div class="cov-item {test_status}">&#x1F9EA; 测试 {test_icon}</div>
</div>
```

Status mapping:
- **ok** → `cov-item ok` class, icon = `✓` (append `(C cached)` if cache hits exist)
- **truncated** → `cov-item warn` class, icon = `⚠ truncated`
- **failed** → `cov-item fail` class, icon = `✗ failed`

## Step 7: Leader-only sections

### Executive Summary

Risk level logic:
- **high** (`exec-risk-badge high`): Critical count > 0 → "建议优先处理严重问题后再合并"
- **medium** (`exec-risk-badge medium`): Critical = 0, Warning > 5 → "无严重问题，存在改进空间"
- **low** (`exec-risk-badge low`): Critical = 0, Warning ≤ 5 → "整体质量良好，无显著风险"

```html
<div class="exec-summary">
  <div class="exec-card">
    <div class="exec-card-header">
      <span class="exec-risk-badge {level}">{label}</span>
      <span class="exec-risk-text">{one-line risk summary}</span>
    </div>
    <div class="exec-card-stats">
      <div class="exec-stat">
        <div class="exec-stat-num">{critical_count}</div>
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

### Module Risk Table

Group findings by directory prefix (e.g., `src/auth/`, `src/api/`). Bar segment `flex` values: `flex:{critical}` / `flex:{warning}` / `flex:{clean}` where clean = total files in module - critical - warning (min 1).

### Collapsible Warnings

```html
<div class="warning-collapsible">
  <input type="checkbox" id="warning-toggle" class="warning-toggle">
  <label for="warning-toggle" class="warning-toggle-label">展开建议改进 ({count} 项)</label>
  <div class="warning-list">
    {warning finding HTML cards}
  </div>
</div>
```

### Action Items

```html
<ul class="action-list">
<li class="action-item"><span class="action-check"></span><span class="action-author">@author</span><span class="action-desc">Fix: {issue}</span><span class="action-file">{file}:{line}</span></li>
</ul>
```

## Step 8: Write and finalize

1. Replace all `[PLACEHOLDER]` strings in the template with their values
2. Clean any remaining `[UNUSED_PLACEHOLDER]` with empty string
3. Use Write to save to `reports/daily-review-[DATE].html`

## Step 9: Update SHA cache

1. Read `.claude/code-review-cache.json` (create empty `{}` if not found)
2. For each reviewed file (not cached, not filtered):
   - key = file path, value = `{ "sha": "<sha>", "result": "<clean|had_critical>", "reviewed_at": "<YYYY-MM-DD>" }`
   - result = "had_critical" if any Critical finding references this file, otherwise "clean"
3. For `[cached — skipped]` files, update `reviewed_at` to today's date (file was accessed but unchanged — refresh its LRU timestamp)
4. Remove entries where `reviewed_at` is more than 30 days ago (30-day LRU: stable files stay cached as long as they're accessed at least once a month)
5. Remove entries for files that no longer exist in the repository
6. Write updated JSON back to `.claude/code-review-cache.json`
