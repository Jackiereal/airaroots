# Design Principles

> These principles govern every product, architecture, and code decision. When trade-offs arise, use these as a tiebreaker.

---

## Product Principles

### P1: Reservations Are the Source of Truth
Every financial record, every operational task, every guest communication traces back to a reservation. If data cannot be linked to a reservation, question whether it belongs in the system.

**Consequence:** Build the reservation engine first, perfectly. Never build finance, operations, or communication before the reservation model is solid.

### P2: Finance Is Derived, Never Manually Entered
Revenue should flow automatically from reservation records. Manual financial entry is an escape hatch, not the default path.

**Consequence:** When a reservation is created or modified, finance records must update automatically via domain events.

### P3: Everything Belongs to an Organization
Every piece of data is owned by an organization. There is no global data visible to all users. Users gain access to data through their membership in organizations.

**Consequence:** Every database table has `organization_id`. Every query is filtered by `organization_id`. RLS enforces this at the database layer.

### P4: Every Module Is Independently Deployable
Housekeeping, finance, AI — each domain can be deployed and maintained independently. No circular dependencies between domains.

**Consequence:** Domains communicate via events, not direct imports. Domain A never imports a service from Domain B.

### P5: API-First
Every capability is accessible via API before it has a UI. The UI is a consumer of the API, not the implementation of business logic.

**Consequence:** Build the API route and domain service first. Build the UI component second.

### P6: AI Is an Assistant, Never the Source of Truth
AI can recommend. AI can forecast. AI can flag anomalies. AI cannot create, update, or delete data on behalf of users. Every AI action requires human confirmation.

**Consequence:** AI surfaces suggestions with a confidence score. Users approve or dismiss. No auto-apply for financial or reservation data.

### P7: Never Break Backward Compatibility
Existing API consumers, existing data, and existing integrations must not break when new features are added.

**Consequence:** Additive-only migrations. No column renames after go-live. Deprecate before removing. Version APIs when breaking changes are unavoidable.

### P8: Scale to Hundreds of Properties
Every feature must be tested and designed to handle a single organization with 500 properties. Batch operations, pagination, and indexes must be considered from day one.

**Consequence:** Never build a feature that does a full-table scan. Every list endpoint must be paginated. Background jobs handle bulk operations.

### P9: Automation Over Manual Workflows
If the system can do it automatically when a known event occurs, it should. Manual input is reserved for decisions that require human judgment.

**Consequence:** Build automation rules for: post-booking housekeeping assignment, pre-arrival guest messages, post-checkout review requests, recurring expense creation.

### P10: Favor Simplicity, Resist Premature Abstraction
Three similar files are better than a premature abstraction. Do not create a shared utility for one use case. Wait for the third use case before extracting.

**Consequence:** Engineers should feel friction before creating a new shared utility. Justify the abstraction with at least two existing consumers.

---

## Engineering Principles

### E1: Repository Pattern — All Database Access Through Repositories
Business logic never contains raw SQL or Supabase query builder calls. All data access goes through repository classes.

### E2: Services Contain Business Logic
API routes call services. Services call repositories. Services handle domain logic, validation, and event emission. Repositories handle data access only.

### E3: Strict TypeScript — No `any`
Use `unknown` when type is unknown, then narrow. Never use `any`. All external data must go through Zod validation before typing.

### E4: Zod at System Boundaries
Validate all incoming data at system entry points: API routes, webhook handlers, CSV imports, channel payloads. Internal function calls between typed services do not need re-validation.

### E5: Small, Focused Commits
Each commit does one thing. Refactoring commits are separate from feature commits. Migration commits are separate from code changes.

### E6: Tests Are Non-Negotiable for Domain Logic
All service functions must have unit tests. All API routes must have integration tests. RLS policies must have database tests. No exceptions for "simple" logic.

### E7: Feature Flags Protect All New Features
Every new domain feature goes behind a feature flag. Enable for internal testing first, then gradually roll out. Never deploy unreachable code to production without a flag.

### E8: Soft Deletes for Financial Data
Financial records (reservations, revenue entries, expenses, payouts) are never hard deleted. Always set `deleted_at`. Non-financial records may be hard deleted after confirming no downstream references.

---

## UX Principles

### UX1: Information Density Over Simplicity
Our users are operators, not consumers. Show more data, not less. Use tables, not cards, for list views.

### UX2: Keyboard Navigation for Power Users
Admin users manage large property portfolios. Every action reachable via keyboard. Command palette (Cmd+K) for power navigation.

### UX3: Optimistic UI
User actions should feel instant. Update the UI immediately, sync in background, roll back on error with clear messaging.

### UX4: Mobile for Operations Staff
Housekeeping staff, maintenance technicians, and guest service teams use mobile. Operations screens must be fully functional on a 375px screen.

### UX5: Consistent Loading States
Every async operation must show a skeleton loader, not a spinner. Users should understand what content is loading.

### UX6: Errors Must Be Actionable
Error messages tell the user what went wrong AND what to do next. Never show raw error codes or stack traces to end users.

---

## Security Principles

### S1: Defense in Depth
Security is enforced at three layers: application code, API middleware, and database RLS. A bug in one layer does not expose data.

### S2: Principle of Least Privilege
Users have the minimum permissions required for their role. Organization members cannot access other organizations' data. Property managers cannot access billing data.

### S3: All Sensitive Data Encrypted at Rest
API keys, channel credentials, payment tokens — all encrypted before storage. Never store plaintext credentials in the database.

### S4: Audit Everything
Every create, update, and delete on reservation, finance, and guest data is recorded in `audit_log` with before/after state.
