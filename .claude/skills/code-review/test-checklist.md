# Test Review Checklist

Language-agnostic test quality and coverage review.

## 1. Test Presence

- [ ] Does every new function/method have corresponding tests?
- [ ] Does every bug fix include a regression test that fails before the fix?
- [ ] Are new API endpoints covered by integration tests?
- [ ] Are new UI components covered by component tests?
- [ ] Are critical business logic paths covered?

## 2. Test Quality

- [ ] Do tests verify behavior, not implementation details?
- [ ] Are assertions specific and meaningful (not just `assertNotNull` everywhere)?
- [ ] Do tests cover the happy path, error paths, AND edge cases?
- [ ] Are boundary values tested (empty, null, max, min, zero)?
- [ ] Are async operations tested with proper await/timeout handling?
- [ ] Are test descriptions/names descriptive of the scenario being tested?

## 3. Test Isolation

- [ ] Is each test independent (no shared mutable state between tests)?
- [ ] Are test execution order dependencies absent?
- [ ] Are external resources (DB, filesystem, network) properly isolated with mocks/fakes/testcontainers?
- [ ] Is test data isolated — no test relies on data created by another test?

## 4. Mock & Stub Quality

- [ ] Are mocks used for external boundaries, not internal implementation?
- [ ] Are mocked return values realistic (not just `true`/`false`)?
- [ ] Is there over-mocking that makes tests brittle?
- [ ] Are there any unchecked mock assertions (mock setup without verification)?

## 5. Coverage Gaps

- [ ] Are error/exception paths tested, not just happy paths?
- [ ] Are concurrency/race conditions covered by tests?
- [ ] Are authorization failure paths tested (not just auth success)?
- [ ] Are timeout and retry scenarios tested?
- [ ] Are large-input or high-load edge cases tested?

## 6. Test Maintainability

- [ ] Are tests DRY — shared setup extracted into helpers/fixtures?
- [ ] Are magic numbers in assertions replaced with named constants?
- [ ] Are test files organized to mirror source file structure?
- [ ] Are there commented-out or skipped tests without explanation?

## 7. Flakiness Risk

- [ ] Are there `sleep()` or fixed-time waits that should be polling/events?
- [ ] Are there time-based assertions that could fail at DST boundaries?
- [ ] Are there order-dependent assertions on unordered collections?
- [ ] Are there shared resources (ports, files, DB tables) that could cause conflicts?

## 8. Snapshot Tests (if applicable)

- [ ] Are snapshots reviewed for correctness, not blindly updated?
- [ ] Are snapshots reasonably sized (not capturing entire pages for minor changes)?
- [ ] Are inline snapshots preferred over external snapshot files for small outputs?
