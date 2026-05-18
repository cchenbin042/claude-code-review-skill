# Performance Review Checklist

Language-agnostic performance pattern review.

## 1. Database & External Calls

- [ ] Is there a database query or API call inside a loop? (N+1 pattern)
- [ ] **`trigger: /(for|while|forEach|map)\b[\s\S]{0,200}\bawait\s+\w+\.(find|query|execute)\(/`** — DB query inside loop
- [ ] Are multiple independent queries batchable into one?
- [ ] Are SELECT queries fetching all columns (`SELECT *`) when only a few are needed?
- [ ] **`trigger: /SELECT\s+\*\s+FROM(?!.*LIMIT)/i`** — SELECT * without LIMIT
- [ ] Are there missing database indexes suggested by the query patterns?
- [ ] Are external calls on the critical path that could be made async or deferred?

## 2. Memory

- [ ] Is a large collection fully loaded into memory when streaming or pagination would work?
- [ ] Are large objects being copied unnecessarily instead of passed by reference?
- [ ] Is there an unbounded cache or map that could grow indefinitely?
- [ ] Are file handles, connections, or streams properly closed after use?
- [ ] Is there a memory leak risk in event listeners or callback registrations?

## 3. Computation

- [ ] Is there a nested loop that could be reduced (O(n^2) → O(n) with a map/set lookup)?
- [ ] Is an expensive computation repeated in a loop when it could be hoisted out?
- [ ] Are there recursive calls without memoization or tail-call optimization?
- [ ] Is regex compiled repeatedly inside a loop instead of once at module level?

## 4. I/O & Blocking

- [ ] Is a synchronous/blocking I/O call on a request-handling thread?
- [ ] **`trigger: /\b(fetch|axios\.\w+)\(/`** — HTTP call without explicit timeout config
- [ ] Are file reads done in chunks for large files?
- [ ] Is there unnecessary serialization/deserialization between processing steps?

## 5. Caching Opportunities

- [ ] Is the same value computed or fetched multiple times within a request?
- [ ] Is there immutable reference data fetched repeatedly that could be cached?
- [ ] Would a local variable cache avoid repeated map/dict lookups?

## 6. Concurrency & Async

- [ ] Are independent async operations running sequentially when they could run concurrently?
- [ ] Is there contention on a shared lock that could be reduced with finer-grained locking?
- [ ] Are thread/goroutine/task pools sized appropriately?

## 7. Algorithm & Data Structure

- [ ] Is a list/array being used for frequent lookups where a Set/Map would be O(1)?
- [ ] Is sorting happening more than once on the same data?
- [ ] Is string concatenation in a loop using a builder/buffer pattern?

## 8. Startup & Warmup

- [ ] Is heavy initialization happening at request time instead of startup?
- [ ] Are there lazy-loading opportunities for rarely-used features?
