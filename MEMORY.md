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
- **Fixed 2026-07-09 — reminder feature wired up**: confirmed via user check that only `instrumentation.ts`'s in-process `setInterval` is live in Railway (no Cron Job configured there) — `/api/cron/sync-channels` comment updated to stop claiming it's scheduled; kept as manual/future-external-cron trigger, not removed
  - `findTasksNeedingReminder` now filters by `organizationId`, requires `assigned_to` set + staff has a phone, excludes already-reminded — was previously unscoped and unused
  - New `GET /api/housekeeping/tasks/reminders` (today's un-reminded tasks) + `POST /api/housekeeping/tasks/[id]/remind` (marks sent)
  - `RemindersBanner` on `/dashboard/housekeeping` — shows count + one-click "Remind {name}" wa.me buttons; clicking opens WhatsApp and calls `/remind`
  - **Important limitation, by design**: this is NOT server-automated. `wa.me` links only work via human click — there is no WhatsApp Business API integration in this codebase, so no true auto-send exists. A manager must click each reminder button manually. Real send-side automation requires Phase 5's planned WhatsApp Business API (Interakt/Wati) work.
- Push notifications to staff (native push, not WhatsApp) on task creation/assignment: still not built — separate from the reminder banner above

## Finance Data Architecture (critical — no double-counting)
- `property_finance_airbnb_rows` = CSV import source for P&L (Airbnb payouts, fees, gross earnings)
- `property_finance_direct_bookings` = direct booking revenue entries (manual + auto from direct reservations)
- `property_finance_expenses` = expenses (housekeeping auto-logged, maintenance manual, etc.)
- `reservations` = calendar/occupancy source (iCal sync + CSV upsert via confirmation_code)
- `calendar_blocks` = derived from reservation events via event bus
- `finance.handler.ts` — only creates direct_bookings entries for `channel === 'direct'` (Airbnb skipped)
- Revenue tab reads `aggregates.bankPayouts` (Airbnb) + `aggregates.directTotal` from summary API

## Mobile UX Pass (2026-07-10)
- **Layer 1 — responsive shell**: `AdminSidebar.tsx`/`ClientSidebar.tsx` were permanent `w-56` sidebars with zero mobile support. Fixed via new `components/ui/MobileSidebarShell.tsx` — hides sidebar below `md`, shows a hamburger top bar that opens a slide-over drawer (route-change auto-closes). All 4 layout files (`app/dashboard/layout.tsx`, `app/admin/layout.tsx`, `app/properties/layout.tsx`, `app/client/layout.tsx`) changed `flex` → `flex flex-col md:flex-row` to stack the mobile bar above content.
- **Layer 2 — targeted fixes**: dashboard tables wrapped in `overflow-x-auto overscroll-x-contain touch-pan-x` + `min-w-[Nrem]` (house pattern, originally only in `PropertyFinanceContent.tsx`); `HousekeepingBoard.tsx` kanban `grid-cols-4` → `grid-cols-1 md:grid-cols-2 lg:grid-cols-4`; page containers `p-6` → `p-4 sm:p-6` (13 pages); `FinanceTabBar.tsx`/`PlanningHub.tsx` tab-bar `w-fit` rows made horizontally scrollable (were overflowing off-screen with no scroll affordance).
- **Native `<select>` fully replaced app-wide** — user reported native selects render as tiny/mispositioned popups on mobile. Built `components/ui/Picker.tsx`: button trigger → modal (bottom sheet on mobile via `max-sm:`, centered dialog on `sm:`+) listing options as tappable rows with a checkmark. Hand-rolled (not `@radix-ui/react-select`, which is installed but unused — wrong shape; not `@radix-ui/react-dialog` — nesting risk since several selects live inside existing Radix dialogs). `createPortal` to `document.body` at `z-[200]` (above the app's `z-[101]` dialogs) avoids focus-trap conflicts when nested.
  - API: `<Picker value onChange options={{value,label,description?,disabled?}[]} placeholder? label? size='default'|'compact' searchable? className? />` — callers normalize their own data shape into `{value,label}[]`, Picker doesn't branch on input shape.
  - Migrated all 46 `<select>` occurrences across 14 files. `components/ui/FilterSheet.tsx` (a same-session "Filters panel" component) was fully deleted — instead each Picker is self-contained inline, no separate filter-drawer wrapper needed.
  - `PropertyFinanceContent.tsx`'s cascading category/sub-category `ExpenseCategoryPicker` decomposed into two `<Picker>`s + kept its `__custom__` free-text escape hatch bespoke in the caller (Picker doesn't know about it). Lost native HTML `required` validation on selects — added explicit `if (!expenseType) { setError(...); return; }` guards in `onAddExpense`/`onSaveExpenseEdit` to compensate.
  - Found (not fixed, flagged only): `PropertyFinanceContent.tsx`'s `onAddExpense` has `fetch('/api/finance/${propertyId}/expenses'` — **not a template literal** (no backtick), so `${propertyId}` never interpolates. Pre-existing bug, out of scope.
- **Layer 3 — table → card conversion**: user wanted mobile to show stacked cards instead of horizontal-scroll tables. Built `components/ui/ResponsiveTable.tsx` (`ResponsiveTable` wrapper: `table` prop under `hidden md:block`, `cards` prop under `md:hidden`; `TableCard` — title/titleExtra/fields/actions/tone card primitive). Converted 12 tables across 8 files: `ReservationListClient.tsx`, `InventoryManager.tsx` (low-stock amber tint preserved via `tone="amber"`), `MaintenanceList.tsx`, `PropertyFinanceContent.tsx` ×4 (Direct Bookings, Airbnb Reservations, OOP modal, all-months summary w/ totals card), `PricingSimulator.tsx` (editable inputs per card), `RevenueEngine.tsx` (totals card), `LoanManager.tsx` (amortization schedule, up to ~240 cards), `ExpenseEngine.tsx` ×2 (category breakdown, monthly list w/ totals card).
  - Excluded: `PropertyFinanceContent.tsx`'s guest-headcount table — a fixed 3-row stat matrix (Total/Airbnb/Direct × This month/All-time), not a real list, left as-is.
  - Intentionally NOT converted (kept as horizontal scroll): `TimelineView.tsx` (calendar — genuinely needs horizontal space), `FinanceTabBar.tsx`/`PlanningHub.tsx` tab strips (not data tables).
  - Desktop table markup is untouched (same JSX, just `hidden md:block` wrapper) — no visual regression at `md`+.

## User Preferences
- Currency: INR (₹), locale: en-IN
- Caveman mode active (full)
