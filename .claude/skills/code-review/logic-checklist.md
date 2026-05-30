# Logic Review Checklist

> **grep 引擎**: 本文件所有 trigger 模式基于 ripgrep (rg) 语法。若降级为 grep -E，跳过含 `(?!)`、`\s\S` 的高级模式。

Language-agnostic business logic and correctness review.

## 1. Edge Cases & Boundaries

- [ ] Empty collections: what happens when a list/dict/set is empty?
- [ ] Null/nil/None: is every nullable value checked before use?
- [ ] Zero values: does the code handle 0, 0.0, empty string, false?
- [ ] Max/min values: what happens at INT_MAX, array size limits, string length limits?
- [ ] Negative numbers: are they handled where they don't make sense (array index, size)?
- [ ] Unicode/special characters: are non-ASCII inputs handled correctly?

## 2. Error Handling

- [ ] Are errors from external calls (DB, API, filesystem) handled explicitly?
- [ ] Is there any `catch`/`except` block that silently swallows errors?
- [ ] **`trigger: /catch\s*\([^)]*\)\s*\{\s*\}/`** — empty catch block, error silently dropped
- [ ] Do error responses include enough context for debugging without leaking internals?
- [ ] Are retryable errors distinguished from permanent failures?
- [ ] Is there a circuit breaker or timeout on external service calls?

## 3. State & Data Consistency

- [ ] Are multi-step mutations wrapped in transactions where needed?
- [ ] If a partial failure occurs, is the system left in a consistent state?
- [ ] Are idempotency keys used for payment/charge operations?
- [ ] Is there any cached data that could become stale after a write?

## 4. Concurrency

- [ ] Are shared mutable variables protected by locks, atomics, or channels?
- [ ] Could two concurrent requests produce a duplicate record?
- [ ] Are database operations using appropriate isolation levels?
- [ ] Is there a race between checking a condition and acting on it (TOCTOU)?

## 5. Timeouts & Retries

- [ ] Do external calls have explicit timeouts?
- [ ] Are retries implemented with exponential backoff and jitter?
- [ ] Is there a maximum retry count or deadline?

## 6. Return Values

- [ ] Are return values from functions checked where ignoring them would be a bug?
- [ ] Do boolean functions have clear success/failure semantics?
- [ ] Are optional/Maybe types unwrapped safely?

## 7. Configuration & Hardcoding

- [ ] Are magic numbers extracted into named constants?
- [ ] Are environment-specific values (URLs, ports, feature flags) configurable?
- [ ] Is there any hardcoded file path that won't work in production?
