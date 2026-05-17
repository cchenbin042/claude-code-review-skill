---
name: code-review
description: Universal code review methodology and severity grading standards. Preloaded into review agents to ensure consistent, actionable review comments across all dimensions.
user-invocable: false
---

# Code Review Skill

Provides review methodology and severity grading that all review agents follow. This skill defines *how* to review — the checklists define *what* to look for.

## Severity Grades

Every finding must be classified into one of three levels:

### Critical

The change introduces a clear security vulnerability, data corruption risk, or guaranteed production crash. **Fix before merge.**

Indicators:
- Attacker-controllable input reaches a dangerous sink without validation
- Secrets or credentials in committed code
- SQL/command injection with no mitigation
- Authentication bypass or privilege escalation
- Data loss or silent corruption path
- Infinite loop or unbounded resource consumption on common input

### Warning

The change may cause issues under certain conditions, violates established best practices, or degrades maintainability. **Address in a follow-up PR or before the next release.**

Indicators:
- Missing error handling on external calls
- Potential null/nil dereference on uncommon code path
- N+1 query pattern introduced
- Logging sensitive data
- Race condition under concurrent access (low probability)
- Deprecated API usage without migration plan

### Kudo

Well-written code worth highlighting. **Positive reinforcement for the team.**

Indicators:
- Elegant simplification that reduces complexity
- Well-placed defensive check preventing a real edge case
- Clear naming that makes intent obvious
- Good test coverage of edge cases
- Thoughtful error messages with actionable context

## Review Comment Format

Every finding MUST follow this structure:

```
**Severity**: [Critical | Warning | Kudo]
**Category**: [Security | Logic | Style | Performance]
**File**: `<path>:<line>`
**Issue**: One-sentence description
**Risk**: Why this matters — what could go wrong
**Fix**: Concrete suggestion, preferably with a code sketch
```

## Pre-Review Protocol

Before inspecting the diff, a review agent MUST:

1. Read the changed files directly — never review from summaries or `git diff --stat` alone
2. Identify the language of each changed file by extension
3. Load the checklist for the assigned review dimension
4. Note the project's dependency files (package.json, go.mod, requirements.txt, Cargo.toml, etc.)

## Post-Review Rules

1. Never report the same issue across multiple agents — if overlap is suspected, assign to the most specific category
2. Skip files with zero substantive changes (comments only, formatting only)
3. Limit to the 10 most important findings per agent — prioritize by severity, then by impact scope
4. Every Critical finding MUST include a concrete fix suggestion
5. When citing a line number, verify it from the actual file, not the diff hunk header
