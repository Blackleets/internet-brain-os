# Engineering Standards

## Architecture Principles
- **Local-First**: Data is stored and processed locally by default; synchronization is optional and user-controlled.
- **Modularity**: The system is composed of loosely coupled, highly cohesive modules (Kernel, Obsidian bridge, Skills, Agents).
- **Evidence-First**: All conclusions, summaries, and actions must be traceable to source evidence (web pages, documents, etc.).
- **Extensibility**: New capabilities are added via Skills and Agents without modifying core Kernel.
- **Technology Neutrality**: Prefer open standards and avoid vendor lock-in; favor local, free, and self-hostable solutions.
- **Privacy by Design**: No data leaves the user's device without explicit consent and transparent disclosure.
- **Longevity**: Favor simple, stable technologies over trendy frameworks; prioritize maintainability over novelty.

## Code Quality
- **TypeScript Strict Mode**: Use `strict: true` in `tsconfig.json`; avoid `any` unless absolutely necessary (and then only with explicit comment).
- **Naming**: Use descriptive names; favor clarity over brevity.
- **Functions**: Keep functions small and focused (max 20-30 lines); pure functions preferred.
- **Classes**: Prefer composition over inheritance; use interfaces for contracts.
- **Error Handling**: Never swallow errors; either handle them gracefully or propagate with context.
- **Constants**: Use `const` for values that won't change; `let` only when reassignment is needed.
- **Magic Numbers/Avoid Hardcoding**: Extract to named constants or configuration.
- **Formatting**: Use Prettier with project's `.prettierrc` (if exists); otherwise, 2-space semicolons.
- **Linting**: ESLint with TypeScript plugin; fix all lint errors before committing.
- **Dead Code**: Remove unused imports, variables, functions, and files.
- **Dependencies**: Prefer native TypeScript/JS features over libraries when possible.

## Dependency Policy
- **Approval Required**: All new dependencies must be justified and approved via PR review.
- **Lockfile**: `pnpm-lock.yaml` must be committed; never edit manually.
- **Audit**: Run `pnpm audit` regularly; fix high/critical vulnerabilities promptly.
- **Peer Dependories**: Respect peer dependencies; avoid version conflicts.
- **DevDependencies**: Keep build/test dependencies separate from production.
- **Local First**: Prefer bundling minimal, audited dependencies over large frameworks.
- **Transitive Dependencies**: Review periodically; use `pnpm list` to audit.

## Testing Policy
- **Test Coverage**: Aim for high unit test coverage (>80%) on core logic; integration tests for critical paths.
- **Test Frameworks**: 
  - Unit: Vitest (primary), Jest (if migrating).
  - E2E: Playwright or Cypress (for web apps).
- **Test Naming**: `describe` for units/groups, `it` for specific behaviors; use given/when/then style.
- **Mocks**: Mock external dependencies (network, filesystem, localStorage); avoid over-mocking.
- **Fixtures**: Use real-world samples for data-driven tests (st tests; store in `__fixtures__`/`test/fixtures`.
- **CI**: Run tests on every PR; block merge on failure.
- **Test Data**: Never use real user data in tests; use synthetic or anonymized data.
- **Flaky Tests**: Investigate and fix immediately; quarantine if necessary.

## Error Handling
- **Types**: Use TypeScript interfaces/classes for error types when appropriate.
- **Context**: Always include contextual information (what operation failed, input values, timestamps).
- **Logging**: Log errors with appropriate level (error, warn) and context; never log sensitive data.
- **User Errors**: Distinguish between developer errors (bugs) and user errors (invalid input); handle gracefully.
- **Recovery**: Attempt graceful degradation; fail safe.
- **Assertions**: Use `assert` functions for internal invariants; remove or disable in production if performance-critical.

## Logging
- **Levels**: Use standard levels (trace, debug, info, warn, error, fatal).
- **Structure**: Prefer structured logging (JSON) for production; human-readable for development.
- **Context**: Include request/user/session IDs when available.
- **PII**: Never log personally identifiable information, passwords, tokens, or keys.
- **Performance**: Avoid excessive logging in hot paths; use sampling if needed.
- **Storage**: Logs are local-only by default; optional remote shipping with encryption and consent.

## Comments
- **Why, Not What**: Explain the reason behind non-obvious decisions; avoid restating the code.
- **TODO/FIXME**: Use sparingly; include ticket/reference if possible.
- **Documentation Comments**: Use JSDoc for all public APIs; include params, returns, throws, examples.
- **Removed Code**: Do not leave commented-out code; use version control for history.
- **Section Headers**: Use comment blocks to separate logical sections in large files.

## Documentation
- **Inline**: JSDoc for all exported functions, classes, and interfaces.
- **Architecture**: Keep `docs/architecture.md` up-to-date with major components and data flow.
- **API Docs**: Generate from JSDoc if exposing external APIs; otherwise, maintain manually.
- **Tutorials**: Provide getting-started guides in `/docs`.
- **Changelog**: Update `CHANGELOG.md` for every user-facing change.
- **Decision Logs**: Record architectural decisions in `docs/` or `brain/`.
- **Language**: Write in clear, concise American English; avoid jargon when possible.
- **Diagrams**: Use Mermaid or Excalidraw for architecture/flow diagrams; store source in `.md` or separate assets.

## Refactoring Rules
- **Tests First**: Ensure adequate test coverage before refactoring.
- **Small Steps**: Make small, reversible changes; commit frequently.
- **Preserve Behavior**: Refactorings must not change external behavior (verified by tests).
- **Boy Scout Rule**: Leave the code cleaner than you found it.
- **Patterns**: Apply established patterns (Strategy, Observer, Dependency Injection) where beneficial.
- **Technical Debt**: Track and prioritize refactoring tasks in the issue tracker.

## Backward Compatibility
- **Semantic Versioning**: Follow SemVer for public APIs (if any); major version for breaking changes.
- **Deprecations**: Mark deprecated APIs with JSDoc `@deprecated`; provide migration path.
- **Removal Schedule**: Deprecated features removed after at least one minor release.
- **Internal APIs**: More flexibility, but still avoid breaking changes without notice.
- **Configuration**: Schema changes must be backward-compatible or provide migration scripts.

## Performance
- **Budget**: Define performance budgets (e.g., page load < 2s, API response < 200ms).
- **Measurement**: Use Lighthouse, Web Vitals, or custom instrumentation.
- **Optimization**: Profile before optimizing; focus on hotspots.
- **Bundle Size**: Monitor JavaScript bundle size; use code-splitting and lazy loading.
- **Memory**: Avoid memory leaks; dispose of listeners, timers, and large objects.
- **Database**: Use indexes; avoid N+1 queries; paginate large result sets.
- **Third-Party**: Audit impact of third-party scripts and iframes.

## Security
- **Data Protection**: Encrypt sensitive data at rest (e.g., passwords, API keys) using industry-standard libraries.
- **Secrets**: Never commit secrets; use environment variables or secret managers.
- **Input Validation**: Validate and sanitize all external inputs (user, file, network).
- **Output Encoding**: Escape outputs based on context (HTML, JS, CSS, URL).
- **Authentication**: Use strong, vetted libraries (e.g., bcrypt, Argon2) for password handling.
- **Authorization**: Implement least-privilege access controls.
- **CSRF/XSS**: Apply standard web protections if serving web content.
- **Dependencies**: Regularly update dependencies; monitor for vulnerabilities (Dependabot, npm audit).
- **Configuration**: Disable debug modes and verbose logging in production.
- **Reviews**: Conduct security reviews for new features involving authentication, encryption, or data handling.