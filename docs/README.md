# Airaroots Engineering Handbook

> Version: 2.0
> Status: Authoritative
> Audience: Engineering team, Claude Code, AI assistants
> Last Updated: 2026-07-07

This is the single source of truth for the Airaroots platform. Every engineer, every AI assistant, and every contributor must read the relevant sections before making any change.

---

## How to Use This Handbook

**Before building any feature:**
1. Read `01 Vision/` — understand why we are building this
2. Read `02 Product/` — understand what we are building
3. Read `03 Architecture/` — understand how the system is structured
4. Read `04 Database/` — understand the data model
5. Read the relevant `05 Domains/` file for your feature
6. Read the relevant `06 Integrations/` file if connecting external services

**Before writing any code:**
1. Check `09 Dev/Claude Instructions.md` for the exact implementation workflow
2. Check `09 Dev/Definition of Done.md` for acceptance criteria
3. Check `09 Dev/Roadmap.md` to confirm what phase your feature belongs to

---

## Document Index

| Section | Contents |
|---------|----------|
| `01 Vision/` | Executive summary, product vision, positioning, principles, competitive analysis |
| `02 Product/` | Personas, user journeys, functional & non-functional requirements, feature matrix, pricing |
| `03 Architecture/` | System overview, DDD, event-driven architecture, multi-tenancy, folder structure, standards |
| `04 Database/` | Schema philosophy, complete schema, ER diagrams, RLS policies, migrations |
| `05 Domains/` | Specification for every domain: Organization, Users, Properties, Reservations, Calendar, Guests, Finance, Housekeeping, Maintenance, Inventory, Vendors, Staff, Reports, Analytics, AI |
| `06 Integrations/` | Airbnb, Booking.com, Stripe, Razorpay, WhatsApp, Google Calendar, Smart Locks |
| `07 UI/` | Design system, component library, responsive rules, accessibility |
| `08 AI/` | AI architecture, agents, prompt standards, recommendation engine |
| `09 Dev/` | Roadmap, milestones, definition of done, Claude instructions, release process |

---

## Architecture in One Sentence

Airaroots is a multi-tenant, event-driven, domain-driven SaaS platform where reservations are the source of truth, finance is derived from reservations, and every operation is scoped to an organization.

---

## Current Implementation State (2026-07-07)

**Built:**
- Auth (Supabase Auth + user_profiles)
- Properties CRUD
- Finance module (expenses, Airbnb CSV import, direct bookings, loans, projections)
- Admin + client role separation

**Not yet built (per roadmap):**
- Organizations layer
- Reservation engine
- Universal calendar
- Channel manager (Airbnb API, Booking.com API)
- Guest CRM
- Operations (housekeeping, maintenance, inventory)
- Communication automation
- AI layer
- Billing / subscriptions
- Background job queue

**Next priority:** Phase 1 — Reservation Engine + Universal Calendar (see `09 Dev/Roadmap.md`)

---

## Non-Negotiable Rules

1. Never delete financial data — soft delete only (`deleted_at`)
2. Every table must have `organization_id` — no exceptions
3. Business logic lives in domain services, never in API routes
4. All API routes must be thin — validate, call service, return
5. Never bypass RLS — all data access goes through Supabase client with auth context
6. No `any` in TypeScript
7. Zod validation on all external inputs
8. All major features behind feature flags until stable
9. Do not start Phase 2 until Phase 1 is complete and tested
10. Update this handbook whenever architecture changes
