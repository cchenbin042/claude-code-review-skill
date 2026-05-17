# Style Review Checklist

Language-adaptive code style and maintainability review.

## Universal Checks (all languages)

### Naming
- [ ] Are names consistent within the same file (no mixing `snake_case` and `camelCase`)?
- [ ] Do names describe intent rather than implementation?
- [ ] Are single-letter variables used only for loop indices or well-known conventions?
- [ ] Are boolean variables prefixed with `is`, `has`, `should`, `can`?

### Structure
- [ ] Are functions/methods reasonably sized? (>50 lines — flag; >100 lines — strongly suggest splitting)
- [ ] Are files reasonably sized? (>500 lines — flag; >1000 lines — strongly suggest splitting)
- [ ] Does each function do one thing (Single Responsibility)?
- [ ] Are there deeply nested conditionals (>3 levels) that could be flattened with early returns?

### Duplication
- [ ] Is the same block of code (or near-identical) repeated within the diff?
- [ ] Could repeated logic be extracted into a shared function or utility?
- [ ] Are there magic values duplicated across multiple locations?

### Comments
- [ ] Are there TODO/FIXME/HACK comments without a ticket reference?
- [ ] Is there commented-out code? (Should be removed — git history preserves it.)
- [ ] Do comments explain *why* rather than *what*?
- [ ] Are there any stale comments that contradict the current code?

### File Organization
- [ ] Are imports organized and free of unused entries?
- [ ] Is the file structure logical (constants → types → functions → exports)?
- [ ] Are new files placed in appropriate directories?

## Language-Specific Checks

Detect language by file extension and apply the relevant subset:

### TypeScript / JavaScript (.ts, .tsx, .js, .jsx)
- [ ] `any` type used where a specific type is available?
- [ ] Are async functions missing `await`?
- [ ] Are there `==` comparisons that should be `===`?
- [ ] Are promises floating (not returned or awaited)?

### Python (.py)
- [ ] Missing type hints on function signatures?
- [ ] Bare `except:` clauses without specific exception types?
- [ ] Mutable default arguments (`def foo(items=[])`)?
- [ ] Line length consistently under 100 chars?

### Go (.go)
- [ ] Unchecked error returns (`val, _ := foo()`)?
- [ ] Exported functions/types without doc comments?
- [ ] `defer` in loops (resource won't free until function exit)?
- [ ] Passing large structs by value instead of pointer?

### Java / Kotlin (.java, .kt)
- [ ] Resources not closed in try-with-resources / use?
- [ ] Nullable returns not annotated or documented?
- [ ] Public fields in classes that should be encapsulated?

### Rust (.rs)
- [ ] `unwrap()` or `expect()` in non-test/non-startup code?
- [ ] `clone()` used where a reference would suffice?
- [ ] Large `match` blocks that could use `?` operator?
- [ ] Unsafe blocks without safety comments?

### Ruby (.rb)
- [ ] `eval` or `send` with user-supplied arguments?
- [ ] Rescue blocks catching Exception instead of StandardError?
- [ ] Class variables (`@@var`) used where class instance variables would work?

### Shell (.sh, .bash)
- [ ] Unquoted variable expansions (`$var` instead of `"$var"`)?
- [ ] `set -euo pipefail` missing?
- [ ] Unsanitized input passed to `eval` or `rm -rf`?
