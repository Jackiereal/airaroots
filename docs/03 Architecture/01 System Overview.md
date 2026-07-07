# System Architecture Overview

---

## C4 Level 1: System Context

```
┌─────────────────────────────────────────────────────────────────────┐
│                         AIRAROOTS SYSTEM                            │
│                                                                     │
│   ┌──────────────┐    ┌──────────────┐    ┌──────────────────────┐ │
│   │   Web App    │    │  Mobile App  │    │      Admin Panel     │ │
│   │ (Next.js)    │    │(React Native)│    │     (Next.js)        │ │
│   └──────┬───────┘    └──────┬───────┘    └──────────┬───────────┘ │
│          │                   │                        │             │
│          └───────────────────┴────────────────────────┘             │
│                              │                                      │
│                    ┌─────────▼──────────┐                           │
│                    │    API Layer       │                           │
│                    │  (Next.js Routes)  │                           │
│                    └─────────┬──────────┘                           │
│                              │                                      │
│          ┌───────────────────┼────────────────────┐                 │
│          │                   │                    │                 │
│   ┌──────▼───────┐  ┌───────▼────────┐  ┌───────▼────────┐        │
│   │   Supabase   │  │  Background    │  │  Event Bus     │        │
│   │  PostgreSQL  │  │  Job Queue     │  │  (Supabase     │        │
│   │  + Auth      │  │                │  │   Realtime)    │        │
│   └──────────────┘  └────────────────┘  └────────────────┘        │
└─────────────────────────────────────────────────────────────────────┘
          │                   │                    │
          ▼                   ▼                    ▼
   ┌──────────────┐  ┌────────────────┐  ┌──────────────────┐
   │    Airbnb    │  │  Booking.com   │  │  WhatsApp/Email  │
   │    API       │  │     API        │  │  Razorpay/Stripe │
   └──────────────┘  └────────────────┘  └──────────────────┘
```

---

## C4 Level 2: Container Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         AIRAROOTS CONTAINERS                         │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    Next.js Application                       │   │
│  │                                                             │   │
│  │  ┌────────────┐  ┌────────────┐  ┌─────────────────────┐  │   │
│  │  │  App       │  │  API       │  │  Server Components  │  │   │
│  │  │  Router    │  │  Routes    │  │  (RSC)              │  │   │
│  │  │  Pages     │  │  /api/**   │  │                     │  │   │
│  │  └────────────┘  └─────┬──────┘  └─────────────────────┘  │   │
│  │                        │                                    │   │
│  │  ┌─────────────────────▼────────────────────────────────┐  │   │
│  │  │                  Domain Services                      │  │   │
│  │  │  Organization │ Reservation │ Finance │ Operations   │  │   │
│  │  │  Calendar     │ Guest       │ Channel │ AI           │  │   │
│  │  └──────────────────────────────────────────────────────┘  │   │
│  │                                                             │   │
│  │  ┌─────────────────────────────────────────────────────┐  │   │
│  │  │                  Repository Layer                    │  │   │
│  │  │  All Supabase queries go through repositories only  │  │   │
│  │  └──────────────────────┬──────────────────────────────┘  │   │
│  └─────────────────────────┼─────────────────────────────────┘   │
│                             │                                       │
│  ┌──────────────────────────▼──────────────────────────────────┐  │
│  │                    Supabase                                   │  │
│  │                                                              │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────────────────┐ │  │
│  │  │ PostgreSQL │  │   Auth     │  │  Realtime (WebSockets) │ │  │
│  │  │ + RLS      │  │  (JWT)     │  │                        │ │  │
│  │  └────────────┘  └────────────┘  └────────────────────────┘ │  │
│  │                                                              │  │
│  │  ┌────────────┐  ┌────────────┐                             │  │
│  │  │  Storage   │  │  Edge      │                             │  │
│  │  │  (files,   │  │  Functions │                             │  │
│  │  │  photos)   │  │  (webhooks)│                             │  │
│  │  └────────────┘  └────────────┘                             │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                   Background Job Queue                        │  │
│  │  (background_jobs table + worker via Supabase Edge Function) │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## C4 Level 3: Key Component — Reservation Domain

```
┌────────────────────────────────────────────────────────────┐
│                   Reservation Domain                        │
│                                                            │
│  ┌────────────────────────────────────────────────────┐   │
│  │              ReservationService                    │   │
│  │                                                    │   │
│  │  createReservation()                               │   │
│  │  updateReservation()                               │   │
│  │  cancelReservation()                               │   │
│  │  checkConflicts()                                  │   │
│  │  processChannelReservation()                       │   │
│  └──────────────────┬─────────────────────────────────┘   │
│                     │                                      │
│  ┌──────────────────▼─────────────────────────────────┐   │
│  │              ReservationRepository                 │   │
│  │                                                    │   │
│  │  findById()     findByProperty()                   │   │
│  │  findByDateRange()  findConflicts()                │   │
│  │  create()       update()       softDelete()        │   │
│  └──────────────────┬─────────────────────────────────┘   │
│                     │                                      │
│  ┌──────────────────▼─────────────────────────────────┐   │
│  │              Database: reservations table          │   │
│  │              + RLS policies                        │   │
│  └────────────────────────────────────────────────────┘   │
│                                                            │
│  ┌────────────────────────────────────────────────────┐   │
│  │              Domain Events Emitted                 │   │
│  │                                                    │   │
│  │  reservation.created                               │   │
│  │  reservation.modified                              │   │
│  │  reservation.cancelled                             │   │
│  │  reservation.checked_in                            │   │
│  │  reservation.checked_out                           │   │
│  │  reservation.conflict_detected                     │   │
│  └────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

### Frontend
| Technology | Version | Purpose |
|-----------|---------|---------|
| Next.js | 16.x | App framework, routing, SSR/RSC |
| React | 19.x | UI library |
| TypeScript | 5.x | Type safety |
| Tailwind CSS | 4.x | Utility-first styling |
| Radix UI | Latest | Accessible component primitives |
| TanStack Query | 5.x | Server state management, caching |
| React Hook Form | 7.x | Form management |
| Zod | 3.x | Schema validation |
| Recharts | 3.x | Data visualization |
| date-fns | 4.x | Date manipulation |
| Lucide React | Latest | Icon system |

### Backend
| Technology | Version | Purpose |
|-----------|---------|---------|
| Next.js API Routes | 16.x | API layer (serverless) |
| Supabase | Latest | PostgreSQL, Auth, Storage, Realtime |
| PostgreSQL | 15.x | Primary database |
| Row Level Security | — | Multi-tenant data isolation |
| Supabase Edge Functions | — | Webhooks, background jobs |

### Infrastructure
| Technology | Purpose |
|-----------|---------|
| Vercel | Frontend + API hosting, auto-scaling |
| Supabase Cloud | Database, auth, storage |
| Supabase Storage | Property photos, documents |
| Cloudflare | CDN, DDoS protection (Phase 8) |

### Planned Additions (by phase)
| Technology | Phase | Purpose |
|-----------|-------|---------|
| Inngest / Trigger.dev | 2 | Background job orchestration |
| Resend | 5 | Transactional email |
| WhatsApp Business API | 5 | Guest messaging |
| Twilio | 5 | SMS fallback |
| Stripe | 8 | International payments |
| Razorpay | 8 | India payments |
| Claude API | 6 | AI recommendations |
| React Native | 8 | Mobile app |

---

## Request Lifecycle

```
Browser Request
    │
    ▼
Next.js Middleware (lib/supabase/middleware.ts)
    │ — validates session
    │ — refreshes token if needed
    │ — sets user context
    ▼
Next.js Route Handler (app/api/[route]/route.ts)
    │ — parse + validate request body with Zod
    │ — extract user from session
    │ — check permission (role + organization)
    ▼
Domain Service (src/domains/[domain]/services/[service].ts)
    │ — business logic
    │ — domain validation
    │ — emit domain events
    ▼
Domain Repository (src/domains/[domain]/repositories/[repo].ts)
    │ — Supabase query (filtered by org_id via RLS)
    │ — map DB row to domain type
    ▼
Supabase PostgreSQL
    │ — RLS policies verify auth.uid() access
    │ — returns rows user is authorized to see
    ▼
Repository maps to typed response
    ▼
Service returns domain object
    ▼
Route handler returns JSON response
    ▼
Browser / TanStack Query cache updated
```

---

## Architecture Decision Records (ADRs)

### ADR-001: Supabase over Custom PostgreSQL

**Decision:** Use Supabase hosted PostgreSQL, not self-hosted.

**Rationale:** Auth, RLS, Storage, and Realtime all built-in. Reduces operational burden significantly. RLS provides database-native multi-tenancy. Cost: ~$25–100/month vs. engineering time to build equivalents.

**Trade-offs:** Less control over database configuration. Vendor lock-in for auth. Acceptable for current scale.

---

### ADR-002: Next.js App Router over Separate Backend

**Decision:** Use Next.js API routes as the API layer, not a separate Express/NestJS backend.

**Rationale:** Single deployment unit. Server Components reduce API calls for read-heavy pages. Shared types between frontend and API routes. No CORS complexity.

**Trade-offs:** Cannot scale API and frontend independently. Acceptable until >10,000 concurrent users.

---

### ADR-003: Repository Pattern over Direct Supabase Queries

**Decision:** All database access goes through repository classes. No direct Supabase calls in components or API routes.

**Rationale:** Testability (repositories can be mocked). Single place to add query optimizations. Prevents scattered data access logic.

**Trade-offs:** More boilerplate. Worth it for maintainability.

---

### ADR-004: Domain Events over Direct Function Calls

**Decision:** When a reservation is created, emit a `reservation.created` event. Do not directly call housekeeping service or finance service from reservation service.

**Rationale:** Prevents tight coupling between domains. New downstream effects can be added without modifying the reservation service. Enables async processing.

**Trade-offs:** Harder to trace execution flow. Requires event bus implementation.

---

### ADR-005: background_jobs Table over External Queue

**Decision:** Phase 1–7 uses a `background_jobs` table in PostgreSQL + polling worker. Phase 8 evaluates Inngest or Trigger.dev.

**Rationale:** Zero additional infrastructure for early phases. PostgreSQL is already the system of record. Simple to implement, debug, and monitor.

**Trade-offs:** Not as scalable or feature-rich as dedicated queue. Switch to external queue when job volume >100k/day.

---

### ADR-006: Soft Deletes for Financial Records

**Decision:** Financial records (reservations, revenue entries, expenses, payouts) are never hard-deleted. All have `deleted_at` column.

**Rationale:** Financial data must be auditable. Regulatory requirements. Supports undo operations.

**Trade-offs:** Queries must filter `WHERE deleted_at IS NULL`. Repository layer handles this transparently.
