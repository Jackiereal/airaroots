# Airaroots Project Memory

## Stack
- Next.js 16.2.10, React 19, TypeScript strict, Tailwind CSS v4
- Supabase (PostgreSQL + RLS + Realtime), zod v4
- No tailwind.config.js — uses CSS custom properties via globals.css

## Project State (2026-07-09)
- Phase 1 COMPLETE: Reservation Engine + Universal Calendar
- Phase 2 COMPLETE: Channel Manager (all features live, pushed to Railway)
- Phase 3 IN PROGRESS: Housekeeping & Operations (core built, live on Railway)
  - Vendor directory UI added 2026-07-09 (`/dashboard/vendors`) — last major gap closed
  - Remaining: push notifications to housekeeping staff on task creation/checkout (not built — no push/notification code anywhere; decided against for now, WhatsApp auto-notify or true web push both deferred)
- Phase 4 (Guest CRM) DEFERRED post-MVP — swapped after Operations in roadmap; not needed for MVP launch
- `docs/09 Dev/Roadmap.md` and `docs/09 Dev/Milestones.md` updated 2026-07-09 to reflect Phase 3/4 swap
- 2026-07-09 fixes (uncommitted as of writing): reservation detail page missing action buttons, housekeeping board default view, checkout status bug — see "Reservation → Housekeeping Automation" section below

### Phase 2 — Built
- iCal sync: Airbnb + Booking.com + VRBO via `src/domains/channel/`
- Auto-sync every 15min via `instrumentation.ts` setInterval (production)
- iCal export at `/api/ical/[token]` (Google Calendar subscribe)
- CSV import: writes `property_finance_airbnb_rows` + upserts `reservations` + `calendar_blocks`
- `finance.handler.ts` skips non-direct channels (no double-counting)
- Revenue tab: reads `aggregates.bankPayouts` + `aggregates.directTotal` from summary API
- Channels UI `/dashboard/channels`: connect, sync now, pause/resume, edit iCal URL, disconnect
- Sync logs `/dashboard/channels/[connectionId]`: per-run stats, IST timestamps
- Server-rendered timestamps: always use `{ timeZone: 'Asia/Kolkata' }`
- Dark/light theme toggle in AdminSidebar footer; flash prevention in RootLayout
- Card tone colors: CSS vars (`--tone-*-bg/bd/tx`) replace hardcoded `bg-*-950/30` dark classes

## Key Architecture
- `src/domains/` — business logic (services, repositories, event handlers)
- `src/infrastructure/` — event bus, supabase re-exports
- `src/shared/` — errors, types, utils
- `app/` — thin Next.js routes + pages
- `components/` — React components

## Important Patterns
- `createServiceRoleClientLoose()` — use when tables not in DB types stub (returns untyped SupabaseClient)
- `requireOrgAuth()` — `src/shared/utils/route-auth.ts` — validates auth + resolves organization_id
- `handleApiError()` — `src/shared/utils/api-error-handler.ts` — handles ZodError + AppError + unknown
- Event bus: `src/infrastructure/events/event-bus.ts` — call `ensureHandlers()` before first service use
- org bridge: migration 008 sets `user_profiles.organization_id = user.id` (personal org until Phase 8)
- org_id lookup: always from `user_profiles.organization_id`, NOT from `properties` table

## DB Migrations Applied
- 001: initial schema (user_profiles, properties, finance tables)
- 002: add projections_config
- 003: reservations + reservation_events
- 004: calendar_blocks + seasonal_rates
- 005: guests (basic)
- 006: extend properties (bedrooms, check_in_time, base_nightly_rate, ical_token)
- 007: finance reservation link (reservation_id + source cols on property_finance_direct_bookings)
- 008: org bridge (organization_id on user_profiles, organization_members stub, auto-provision)
- 009: housekeeping_checklist_templates (property_id UNIQUE, organization_id, items JSONB)
- 010: property_finance_expenses.housekeeping_task_id (FK to housekeeping_tasks, partial unique index)
- 011: property_id on housekeeping_staff (NOT NULL, deleted 1 pre-existing row) + vendors (nullable = org-wide)

## Zod v4 Notes
- `z.record(z.string(), z.unknown())` — v4 requires 2 args
- `ZodError` uses `.issues` not `.errors`
- `.string().date()` works for YYYY-MM-DD strings
- `.refine()` callback needs explicit type annotation: `(d: { field: type }) =>`

## DB Types Stub
- `types/database.types.ts` is hand-written — does NOT include new Phase 1 tables
- Run `supabase gen types typescript` after migrations to regenerate
- Until then, use `createServiceRoleClientLoose()` for new table access

## Design Tokens (globals.css)
- `--accent: #1DB954` (green), dark mode via `[data-theme="dark"]` on `<html>`
- Card tone tokens: `--tone-{income|profit|amber|rose|violet}-{bg|bd|tx}` — light/dark auto-adapt
- ThemeToggle: `components/ui/ThemeToggle.tsx` — Moon/Sun button, persists to localStorage
- Flash prevention: inline script in `app/layout.tsx` reads localStorage + prefers-color-scheme

## Channel Colors
- Airbnb: #FF5A5F, Booking.com: #003580, Direct: #22c55e, VRBO: #1B6FEC
- Owner Hold: #6b7280, Maintenance: #f59e0b

## Sidebar Nav
- AdminSidebar main: Dashboard, Calendar, Reservations, Channels, Properties, Users
- AdminSidebar ops: Housekeeping, Maintenance, Vendors, Inventory
- Footer: ThemeToggle + Sign out

## iCal Sync
- `instrumentation.ts` — runs `channelSyncService.syncAll('cron')` every 15min (production only)
- Deduplication: `platform_booking_id` (confirmation_code) unique key in reservations
- iCal = upcoming only, ₹0 pricing; CSV import overwrites with real amounts

## Phase 3 — Housekeeping & Operations (built 2026-07-08)
- Tables: housekeeping_tasks, housekeeping_staff, housekeeping_photos, housekeeping_checklist_templates
- Tables: maintenance_requests, maintenance_photos, inventory_items, inventory_transactions
- Public housekeeper page: `/hk/[token]` — no auth, token is credential, direct service call (no self-fetch)
- Board UI: `/dashboard/housekeeping` — kanban (pending/assigned/in_progress/completed)
- Task creation: auto-sets status=assigned if assignedTo provided at creation
- Checklist templates: per-property at `/dashboard/housekeeping/checklist/[propertyId]`
  - API: GET/PUT/DELETE `/api/housekeeping/templates/[propertyId]`
  - Falls back to DEFAULT_CHECKLIST in `src/domains/operations/constants.ts` if no custom template
- Expense auto-log: on task complete, if customPrice > 0 → inserts into property_finance_expenses (expense_type='housekeeping')
  - Idempotent: checks existing row by housekeeping_task_id before insert
  - created_by = task.createdBy ?? task.organizationId
- Delete: housekeeping tasks + maintenance requests both have DELETE API + trash UI
- Maintenance list: `/dashboard/maintenance` — table view with vendor WhatsApp link + delete
- WhatsApp links built in service (buildWhatsAppUrl / buildVendorWhatsAppUrl)
- Vendor directory: `/dashboard/vendors` (added 2026-07-09) — list/add/edit/deactivate, category filter, show-inactive toggle
  - `VendorManager.tsx` follows same pattern as `StaffManager.tsx` (housekeeping staff page)
  - Backend (`VendorService`, `VendorRepository`, `/api/vendors`, `/api/vendors/[id]`) pre-existed; only the UI was missing
  - Deactivate = soft delete via `isActive: false` PATCH, not a real delete
- Property scoping (added 2026-07-09, migration 011):
  - `housekeeping_staff.property_id` — required. Staff work at one physical property; StaffForm requires selecting it, StaffManager has a property filter
  - `vendors.property_id` — nullable. `undefined`/`null` = org-wide (serves all properties). VendorForm defaults to "All properties (org-wide)"
  - `HousekeepingBoard.tsx` assign/create staff dropdowns filter `staffList` to the task's `propertyId` client-side
  - `MaintenanceList.tsx` vendor dropdown shows vendors where `!v.propertyId || v.propertyId === form.propertyId` (org-wide ∪ property match)
  - `VendorRepository.findByOrg` uses `.or('property_id.eq.X,property_id.is.null')` when filtering by property — always includes org-wide vendors alongside property-specific ones
- No middleware.ts at root — all routes currently unprotected by middleware (only API routes use requireOrgAuth)

## Reservation → Housekeeping Automation (verified 2026-07-09)
- Full chain confirmed working end-to-end via live server logs: check-in click → `POST /api/reservations/[id]/check-in` → `ReservationService.checkIn()` → `transitionStatus()` publishes `reservation.checked_in` → `housekeepingHandler.onCheckedIn` creates a `checkout_clean` task scheduled for the reservation's checkout date (idempotent via `findTaskByReservation`)
- All handlers registered in `src/infrastructure/events/register-handlers.ts`, gated by `ensureHandlers()` (module-level `initialized` flag) — called at the top of check-in/check-out/task-creation API routes
- Full event map: `reservation.created/modified/cancelled` → `calendar.handler` (calendar_blocks CRUD) + `finance.handler` (direct_bookings CRUD, `channel === 'direct'` only); `reservation.checked_in/checked_out/cancelled/modified` → `housekeepingHandler`
- **Bug fixed 2026-07-09**: `onCheckedOut` used to force any pending/assigned task straight to `in_progress` on guest checkout, even with zero staff assigned — misleading, since "In Progress" implies someone's actively cleaning. Fixed: only advances to `in_progress` if `status === 'assigned'`; unassigned tasks correctly stay `pending`
- **UI bug fixed 2026-07-09**: `/dashboard/reservations/[id]` (the full-page detail view) had zero action buttons — Check In/Out/Cancel only existed in the calendar's slide-over (`ReservationDetail.tsx`). Added `components/reservation/ReservationActions.tsx` (client component) and wired into the page
- **UX bug fixed 2026-07-09**: `/dashboard/housekeeping` board defaulted to showing only *today's* tasks with no indicator that tasks exist on other dates — a task created at check-in for a future checkout date was invisible. Added `showAllUpcoming` toggle, **now defaults to `true`** (shows all non-completed/cancelled tasks sorted by date); unchecking narrows to the date picker
- **Known dead code**: `HousekeepingService.getTasksNeedingReminder()` + `markReminderSent()` + `buildReminderWhatsAppUrl()` + `reminder_sent_at` column all exist but nothing calls them — scaffolded "morning-of reminder to staff" feature, never wired to a cron/trigger
- **Known redundancy**: two separate 15-min sync triggers exist in parallel — `instrumentation.ts` in-process `setInterval` (prod only) AND `/api/cron/sync-channels` (external Railway cron, `CRON_SECRET`-protected). Both call `channelSyncService.syncAll('cron')`. Not harmful (idempotent via `platform_booking_id`) but doubles sync frequency/API calls to Airbnb/Booking.com — not yet deduplicated
- Push notifications to staff on task creation/assignment: still not built (see Phase 3 remaining gap above)

## Finance Data Architecture (critical — no double-counting)
- `property_finance_airbnb_rows` = CSV import source for P&L (Airbnb payouts, fees, gross earnings)
- `property_finance_direct_bookings` = direct booking revenue entries (manual + auto from direct reservations)
- `property_finance_expenses` = expenses (housekeeping auto-logged, maintenance manual, etc.)
- `reservations` = calendar/occupancy source (iCal sync + CSV upsert via confirmation_code)
- `calendar_blocks` = derived from reservation events via event bus
- `finance.handler.ts` — only creates direct_bookings entries for `channel === 'direct'` (Airbnb skipped)
- Revenue tab reads `aggregates.bankPayouts` (Airbnb) + `aggregates.directTotal` from summary API

## User Preferences
- Currency: INR (₹), locale: en-IN
- Caveman mode active (full)
