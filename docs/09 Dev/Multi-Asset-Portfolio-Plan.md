# Multi-Asset Portfolio Evolution — Analysis & Phasing Plan

> Status: **Deferred — planned 2026-07-10, revisit later.** No code written.
> Decision: Hybrid approach recommended (foundation now, per-type modules later). First asset type when built: **rental homes**.

## Context

Airaroots today is a short-term-rental (STR/Airbnb) manager. The idea under evaluation: evolve it into a **multi-asset portfolio management app** — one owner or PMC managing a mix of STR villas, hostels/PGs (beds, monthly tenants, staff salaries), long-term rental homes (single tenant, recurring rent), and agricultural land (seasonal income, vendors/maintenance only). The question asked: build this alongside the current market-ready plan, or separately later?

**Verdict: Hybrid (Option C).** Do a cheap ~1–2 week "multi-asset foundation" now, then continue the market-ready STR plan (Phase 8 billing → Phase 5 comms → Phase 7 owner portal), then build per-type modules in order: **rental homes → hostels → agricultural**. Do NOT build full multi-asset before monetization (delays revenue by months), and do NOT defer entirely (Phase 8 pricing, Phase 7 statements, and all new code would bake in "property = STR villa" assumptions that are expensive to unwind).

## Verified current-state facts (explored 2026-07-10)

- `properties` has **no property_type column** — only `platform` ('airbnb'/'direct'/'mixed') + STR-only cols from migration 006 (base_nightly_rate, check_in/out_time, max_guests, ical_token…). Zero property-type conditional logic anywhere in the app.
- Income is exactly two booking-shaped tables: `property_finance_direct_bookings` and `property_finance_airbnb_rows`. `app/api/finance/[propertyId]/summary/route.ts` hardcodes revenue = airbnb payouts + withholding + directTotal.
- **Trap:** `components/finance/RevenueEngine.tsx`'s ~14 manual revenue sources (BBQ, workshops…) are stored as pseudo-bookings inside `direct_bookings` via a `source` column.
- `property_finance_expenses`, `property_finance_loans`, and the operations domain (maintenance/vendors/inventory) are **already asset-agnostic**. `reservations`/`calendar`/`channel` domains are nightly-coupled (incl. GENERATED revenue columns in `reservations`).
- **Zero** rent/tenant/lease/salary/recurring-payment concepts exist anywhere. `housekeeping_staff` has no compensation fields.
- Housekeeping automation is driven purely by `reservation.*` events (`src/infrastructure/events/register-handlers.ts`).
- Org model is the 1:1 personal-org bridge (migration 008); real multi-tenancy is Phase 8 work.

## Data-model strategy

1. **`property_type` column** on `properties`: CHECK in ('str','hostel','rental','agricultural','other'), NOT NULL DEFAULT 'str'. Backfill is a no-op (all current rows are STR). Plus `type_details JSONB DEFAULT '{}'` for non-relational per-type attrs (crop, gender policy, furnishing).
2. **Leave existing STR columns on `properties`** — extraction to a satellite table buys nothing user-visible. Rule going forward: no new type-specific columns on `properties`; use `type_details` or satellite tables.
3. **Income: per-type tables unified in code, NOT a physical unified ledger.** Keep bookings tables untouched; add per-type tables; introduce a `RevenueProvider` abstraction (per property type, seam at `lib/property-finance/` + summary route) returning normalized `{revenueTotal, lineItems, occupancyMetric}`. A physical income ledger was rejected: high backfill cost from messy airbnb_rows CSV semantics + permanent drift/reconciliation risk.
4. **One new generic table: `property_income_entries`** (income mirror of the already-generic expenses table). Triple duty: (a) new home for RevenueEngine's manual sources — extracted out of `direct_bookings`; (b) all agricultural income (season-tagged); (c) one-off income for any type.
5. **Tenancy tables** (land in Phase M1): `tenants` (distinct from `guests` — different lifecycle), `leases` (property_id, nullable unit_id — null = whole home, rent_amount, billing_day, deposit, status; **no GENERATED columns** — rent proration is app-level math), `rent_payments` (lease_id, period_month, amount, paid_date; arrears computed, not stored). Hostels (M2) reuse the same model + `property_units` (room → bed hierarchy, leases point at beds).
6. **Staff salaries** (M2): compensation fields on staff + `property_finance_recurring_expenses` template table with a generator that materializes rows into existing `property_finance_expenses` — also gives rentals/agri recurring costs (property tax, electricity) for free.

## Module applicability & gating

| Module | str | hostel | rental | agri |
|---|---|---|---|---|
| Calendar / Reservations / Channels | ✅ | ❌ (calendar later) | ❌ | ❌ |
| Housekeeping | ✅ | ✅ (schedule-driven) | ❌ | ❌ |
| Maintenance / Vendors | ✅ | ✅ | ✅ | ✅ |
| Inventory | ✅ | ✅ | opt | opt |
| Finance Overview/Expenses/Planning | ✅ | ✅ | ✅ | ✅ |
| Finance Revenue tab shape | bookings | rent-roll | rent | income entries |
| Tenancy (new) | ❌ | ✅ | ✅ | ❌ |
| Units/beds (new) | ❌ | ✅ | ❌ | ❌ |

**Mechanism:** single source of truth `src/domains/property/capabilities.ts` — `PROPERTY_CAPABILITIES: Record<PropertyType, Set<Capability>>` + `hasCapability()`. Consumed by `AdminSidebar.tsx` (show nav item if ANY org property has the capability), `FinanceTabBar`/`PropertyFinanceContent` (per-property tab gating), and API route guards (a rent POST against an STR property must 400 — don't rely on UI gating).

## Sequencing

| Phase | What lands | Size |
|---|---|---|
| **0.5 — Multi-asset foundation** (do before/with Phase 8) | `property_type` + `type_details` migration; `capabilities.ts` + sidebar/tab gating (invisible today — all 'str'); `property_income_entries` + extract RevenueEngine manual sources from `direct_bookings` (copy → verify month totals → delete); rule: all new Phase 5/7/8 code consults the capability map | ~1–2 wks |
| **8 — Billing/orgs** (as planned) | Design plan limits **type-aware** (recommend: hostel = 1 property, bed-count reserved as a future plan dimension); property-create flow gets a type picker (non-STR = "coming soon" — free demand signal) | as planned |
| **5 — WhatsApp comms** (as planned) | Template registry keyed so rent-reminder templates slot in later | as planned |
| **M1 — Rental homes** (first type) | Tenancy domain (`src/domains/tenancy/`: tenants, whole-home leases, rent_payments, arrears service, `lease.*`/`rent_payment.*` events); Rent revenue tab via RevenueProvider refactor of summary route | ~3–4 wks |
| **7 — Owner portal** (after M1) | Statements built revenue-provider-shaped, not booking-shaped; rental owners are the portal's best audience | as planned |
| **M2 — Hostels/PGs** | `property_units` (rooms/beds), bed-level leases, occupancy dashboard, staff salaries + recurring-expense generator, schedule-driven housekeeping | ~6–8 wks |
| **M3 — Agricultural + other** | Income/expense category presets + season tags on `property_income_entries`. That's it — resist crop-cycle management v1 | ~1 wk |

## Key risks

- **Manual-sources extraction** is the only risky production migration (Railway live data) — reversible copy-verify-delete with month-total audit; stage on a Supabase branch first. This is why it's in the foundation, not later.
- Don't copy `reservations`' GENERATED-column pattern into leases — rent math (proration, partial payments) must be app-level.
- Don't generalize the event bus now — add `lease.*` events additively in M1; existing `reservation.*` wiring untouched.
- Per-type UI = capability-gated **components** (rent-roll tab vs bookings tab), not `type === 'rental' ? 'Tenant' : 'Guest'` ternaries sprinkled through shared copy.
- Tenancy tables must be born on the Phase 8 org model, not the personal-org bridge — hard sequencing dependency (M1 after Phase 8).

## Touched vs left alone

- **Touched (foundation):** `properties` (2 cols), `AdminSidebar.tsx`, `RevenueEngine.tsx`, `FinanceTabBar.tsx`, `summary/route.ts` (+ summary-all), `lib/property-finance/aggregate.ts`; new `src/domains/property/`, `property_income_entries` migration.
- **Left alone:** `reservations`, both booking tables (post-extraction `direct_bookings` reverts to pure direct stays), `src/domains/{reservation,calendar,channel}`, existing event wiring, `property_finance_expenses`/`loans`, all operations tables.

## Verification (for whenever Phase 0.5 is executed)

- `npx tsc --noEmit` + `npm run build` clean.
- Post-migration: every existing property shows `property_type = 'str'`; app renders identically (gating is a no-op when all properties are STR).
- Manual-sources extraction audit: per-property per-month revenue totals in the Revenue tab identical before/after; `direct_bookings` contains only genuine stays (rows with check_in/check_out).
- Finance summary API responses byte-comparable pre/post for an STR property.
