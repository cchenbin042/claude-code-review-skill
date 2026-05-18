# Security Review Checklist

Based on OWASP Top 10 and industry best practices. Language and framework agnostic.

## 1. Injection

- [ ] Does any user-controllable input reach SQL/NoSQL queries?
- [ ] **`trigger: /(\+|\+=)\s*(req\.|request\.|params\.|body\.|query\.|\$\{|`\$\{)/`** — string concatenation with user input in query
- [ ] Are parameterized queries or prepared statements used for all database access?
- [ ] Is user input concatenated into shell commands, LDAP queries, or template expressions?
- [ ] Are URL parameters, form fields, headers, and cookies all treated as untrusted?
- [ ] Does ORM usage have any raw query escape gaps?

## 2. Authentication

- [ ] Are password comparisons using constant-time algorithms?
- [ ] **`trigger: /(password|secret|token|hash).*===/`** — weak comparison on sensitive values
- [ ] Is there any hardcoded credential, API key, or token in the diff?
- [ ] **`trigger: /(apiKey|api_key|secret|password)\s*[:=]\s*["'][^$]/`** — literal string assigned to secret-like variable
- [ ] Does session/token generation use cryptographically secure randomness?
- [ ] Are JWT tokens verified with proper algorithm pinning (no `alg: none`)?
- [ ] **`trigger: /jwt\.(verify|decode)\(/`** — JWT verify/decode without algorithm pinning
- [ ] Is there a rate-limit or brute-force protection on login endpoints?

## 3. Authorization

- [ ] Does every endpoint check that the requester owns or is permitted to access the resource?
- [ ] Are there any IDOR risks — resource IDs accepted without ownership verification?
- [ ] Are admin-only operations gated by role checks on the server side (not just UI-hidden)?
- [ ] Are there any privilege escalation paths through parameter manipulation?

## 4. Input Validation

- [ ] Is all external input validated before use (headers, query params, body, file uploads)?
- [ ] Are validation rules enforced on the server side (not just client-side)?
- [ ] Are file uploads checked for type, size, and content?
- [ ] Are there any type confusion or prototype pollution risks?

## 5. Data Exposure

- [ ] Do error messages or stack traces leak internal paths, library versions, or logic?
- [ ] Are passwords, tokens, or PII ever logged?
- [ ] **`trigger: /console\.(log|error)\(.*(password|token|secret|credential)/`** — sensitive data in console output
- [ ] Do API responses return more fields than the client needs (over-fetching)?
- [ ] Are there any sensitive values in comments or debug code?
- [ ] Are internal IPs, hostnames, or infrastructure details exposed?

## 6. CSRF / SSRF

- [ ] Are state-changing requests protected against CSRF?
- [ ] Does the application make outbound HTTP requests based on user-supplied URLs?
- [ ] If so, are internal addresses and metadata endpoints blocked?

## 7. Secrets Management

- [ ] Are there any API keys, passwords, or tokens in the diff?
- [ ] Are secrets read from environment variables or a secrets manager (not config files)?
- [ ] Are `.env`, `.pem`, `.key`, `credentials.*` files excluded via `.gitignore`?

## 8. Dependencies

- [ ] Are new dependencies introduced? If so, are they actively maintained and well-reputed?
- [ ] Do the dependency version ranges allow known-vulnerable versions?
- [ ] Check the project's lock file for any newly added packages with low download counts.

## 9. Cryptography

- [ ] Is any custom crypto or hashing implemented? (Never roll your own.)
- [ ] Are weak algorithms used (MD5, SHA1, DES, RC4)?
- [ ] Are encryption keys stored securely?
- [ ] Is TLS properly enforced for sensitive communication?

## 10. Logging & Monitoring

- [ ] Are authentication events (login, logout, password change) logged?
- [ ] Are authorization failures logged?
- [ ] Do log entries avoid interpolating user input directly (log injection)?
