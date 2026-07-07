# Non-Functional Requirements

---

## NFR-PERF: Performance

| ID | Requirement | Target | Measurement |
|----|-------------|--------|-------------|
| NFR-PERF-01 | API response time (p50) | <200ms | APM |
| NFR-PERF-02 | API response time (p99) | <1000ms | APM |
| NFR-PERF-03 | Calendar page load (500 reservations) | <2s | Lighthouse |
| NFR-PERF-04 | Dashboard page load (first contentful paint) | <1.5s | Lighthouse |
| NFR-PERF-05 | Channel sync latency (webhook → reservation created) | <30s | Internal metric |
| NFR-PERF-06 | Airbnb CSV import (1,000 rows) | <10s | Internal metric |
| NFR-PERF-07 | Finance summary query (12 months, 1 property) | <500ms | Query plan |
| NFR-PERF-08 | Multi-property calendar (50 properties, 30 days) | <2s | Internal metric |
| NFR-PERF-09 | Background job queue processing latency | <60s | Job monitor |

---

## NFR-SCALE: Scalability

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-SCALE-01 | Max properties per organization | 500 |
| NFR-SCALE-02 | Max concurrent users per organization | 50 |
| NFR-SCALE-03 | Max reservations per property per year | 500 |
| NFR-SCALE-04 | Max total reservations in system | 10,000,000 |
| NFR-SCALE-05 | Max organizations | 100,000 |
| NFR-SCALE-06 | Background jobs queue depth | 100,000 |
| NFR-SCALE-07 | Webhook deliveries per minute | 10,000 |
| NFR-SCALE-08 | Concurrent channel syncs | 1,000 |

**Scaling strategy:**
- Supabase handles DB scaling (Postgres with read replicas at 100K+ organizations)
- Vercel auto-scales serverless Next.js functions
- Background jobs scale horizontally via worker pool
- Calendar queries paginated — never load >1,000 reservations in single query
- Finance aggregations cached with 5-minute TTL

---

## NFR-AVAIL: Availability

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-AVAIL-01 | Platform uptime (monthly) | 99.9% |
| NFR-AVAIL-02 | Channel sync uptime | 99.5% |
| NFR-AVAIL-03 | Planned maintenance window | <4hr/month, announced 48hr in advance |
| NFR-AVAIL-04 | Recovery Time Objective (RTO) | <1 hour |
| NFR-AVAIL-05 | Recovery Point Objective (RPO) | <5 minutes |
| NFR-AVAIL-06 | Database backup frequency | Every 6 hours |
| NFR-AVAIL-07 | Backup retention | 30 days |

**Downtime calculation:**
99.9% = 8.7 hours/year downtime budget
Critical degradation: channel sync failure, reservation write failure
Acceptable degradation: AI insights delayed, analytics slow

---

## NFR-SEC: Security

| ID | Requirement |
|----|-------------|
| NFR-SEC-01 | All data encrypted in transit (TLS 1.3) |
| NFR-SEC-02 | All data encrypted at rest (AES-256, Supabase default) |
| NFR-SEC-03 | API keys, channel credentials encrypted before DB storage |
| NFR-SEC-04 | PII fields (guest name, phone, email) encrypted at rest (Phase 8) |
| NFR-SEC-05 | RLS enforced on every table — zero exceptions |
| NFR-SEC-06 | No user can access another organization's data |
| NFR-SEC-07 | API rate limiting: 100 req/min per user, 1000 req/min per org |
| NFR-SEC-08 | JWT tokens expire in 1 hour, refresh tokens in 7 days |
| NFR-SEC-09 | All admin actions logged in audit_log |
| NFR-SEC-10 | OWASP Top 10 mitigation documented and verified |
| NFR-SEC-11 | Dependency vulnerability scanning (npm audit) in CI |
| NFR-SEC-12 | No sensitive data in logs or error messages |
| NFR-SEC-13 | CSRF protection on all mutation endpoints |
| NFR-SEC-14 | SQL injection impossible via parameterized queries only |
| NFR-SEC-15 | XSS prevention: React default escaping + CSP headers |

---

## NFR-COMP: Compliance

| ID | Requirement | Timeline |
|----|-------------|----------|
| NFR-COMP-01 | GDPR: right to deletion for EU guests | Phase 8 |
| NFR-COMP-02 | Indian Data Protection Act compliance | Phase 8 |
| NFR-COMP-03 | PCI-DSS: no card data stored directly | Phase 8 |
| NFR-COMP-04 | GST invoice generation for Indian customers | Phase 8 |
| NFR-COMP-05 | Data residency: Indian org data in Mumbai region | Phase 8 |

---

## NFR-MAINT: Maintainability

| ID | Requirement |
|----|-------------|
| NFR-MAINT-01 | TypeScript strict mode, no any |
| NFR-MAINT-02 | 80%+ unit test coverage on domain services |
| NFR-MAINT-03 | E2E tests for all critical user flows |
| NFR-MAINT-04 | All public API routes have integration tests |
| NFR-MAINT-05 | Migrations are additive-only post go-live |
| NFR-MAINT-06 | All feature flags documented in feature_flags table |
| NFR-MAINT-07 | No circular dependencies between domains |
| NFR-MAINT-08 | CI pipeline runs on every PR (type check, lint, test, build) |
| NFR-MAINT-09 | Zero tolerance for broken main branch |

---

## NFR-OBS: Observability

| ID | Requirement |
|----|-------------|
| NFR-OBS-01 | Structured JSON logging for all server-side operations |
| NFR-OBS-02 | Request tracing with correlation IDs |
| NFR-OBS-03 | Error rate alerting (>1% API error rate) |
| NFR-OBS-04 | Channel sync failure alerting (real-time) |
| NFR-OBS-05 | Background job failure alerting |
| NFR-OBS-06 | Database query slow log (>500ms queries) |
| NFR-OBS-07 | Business metrics dashboard (daily active orgs, reservations synced, revenue processed) |
| NFR-OBS-08 | Uptime monitoring with external probe |

---

## NFR-UX: User Experience

| ID | Requirement |
|----|-------------|
| NFR-UX-01 | All pages responsive down to 375px (mobile) |
| NFR-UX-02 | Loading state for all async operations |
| NFR-UX-03 | Optimistic UI for reservation mutations |
| NFR-UX-04 | Error messages must include next action |
| NFR-UX-05 | All form validations shown inline, not on submit |
| NFR-UX-06 | Keyboard navigation for all primary flows |
| NFR-UX-07 | WCAG 2.1 AA accessibility compliance |
| NFR-UX-08 | Dark mode support (Phase 3) |
| NFR-UX-09 | Session persistence across browser close (7 days) |

---

## NFR-I18N: Internationalization

| ID | Requirement | Phase |
|----|-------------|-------|
| NFR-I18N-01 | All currency amounts support INR as default | Done |
| NFR-I18N-02 | Timezone-aware date/time throughout (property timezone) | 1 |
| NFR-I18N-03 | Date format configurable per organization | 8 |
| NFR-I18N-04 | UI language support: English (default) | Done |
| NFR-I18N-05 | UI language support: Hindi | Phase 9 |
| NFR-I18N-06 | Multi-currency for international properties | Phase 8 |
