# Product Roadmap

> Current date: 2026-07-09
> Current status: Phase 1 & 2 complete, Phase 3 (Operations) in progress. Phase 4 (Guest CRM) deferred — not needed for MVP, reordered after Operations.

---

## Phase Summary

| Phase | Name | Status | Estimated Duration |
|-------|------|--------|-------------------|
| 1 | Reservation Engine + Universal Calendar | Not Started | 4–6 weeks |
| 2 | Channel Manager (Airbnb + Booking.com) | Not Started | 4–6 weeks |
| 3 | Operations (Housekeeping, Maintenance, Inventory) | In Progress | 4–5 weeks |
| 4 | Guest CRM + Reviews | Deferred (post-MVP) | 2–3 weeks |
| 5 | Automation + Communication | Not Started | 3–4 weeks |
| 6 | Revenue Intelligence + AI | Not Started | 4–5 weeks |
| 7 | Owner Portal 2.0 + Reporting | Not Started | 2–3 weeks |
| 8 | Enterprise SaaS (Organizations, Billing, API) | Not Started | 6–8 weeks |
| 9 | AI Copilot + Predictive Insights | Not Started | 4–6 weeks |

---

## Phase 1: Reservation Engine + Universal Calendar

**Goal:** Replace "Airbnb dashboard + Excel" with a proper reservation system.

**Deliverables:**
- [ ] `reservations` table migration (003)
- [ ] `calendar_blocks` + `seasonal_rates` migrations (004)
- [ ] `guests` table (basic, no CRM yet)
- [ ] ReservationService + ConflictDetectionService
- [ ] CalendarService + AvailabilityService
- [ ] API routes: reservations CRUD + calendar blocks
- [ ] Multi-property timeline calendar component
- [ ] Month view calendar
- [ ] Create/Edit reservation modal
- [ ] Reservation detail slide-over panel
- [ ] Block dates functionality
- [ ] Revenue auto-derivation from reservations (FinanceEventHandler)
- [ ] Supabase Realtime for live calendar updates
- [ ] Extend properties table (bedrooms, check-in time, base rate, etc.)

**Done criteria:** Can create a reservation, see it on calendar, and see finance updated automatically.

---

## Phase 2: Channel Manager

**Goal:** Automatic sync from Airbnb and Booking.com. No more CSV imports.

**Deliverables:**
- [ ] `channel_connections` + `channel_sync_logs` migrations (005)
- [ ] `channel_webhook_logs` table
- [ ] Background job queue (`background_jobs` table)
- [ ] Airbnb iCal adapter
- [ ] Booking.com iCal adapter
- [ ] Channel connection UI (connect Airbnb / Booking.com)
- [ ] Sync status dashboard
- [ ] Webhook handlers: `/api/webhooks/airbnb` + `/api/webhooks/booking-com`
- [ ] Conflict detection when channels overlap
- [ ] Conflict resolution UI
- [ ] iCal export per property (Google Calendar sync)
- [ ] Vercel cron jobs for scheduled sync
- [ ] Sync health monitoring

**Done criteria:** Airbnb booking appears in calendar within 30 minutes of being made. Conflicts flagged automatically.

---

## Phase 3: Operations

**Goal:** Automate housekeeping and track maintenance.

**Deliverables:**
- [ ] Operations migrations (007)
- [ ] HousekeepingService + auto-task creation on checkout
- [ ] MaintenanceService + VendorService
- [ ] Housekeeping board (kanban-style)
- [ ] Mobile-optimized housekeeping task UI
- [ ] Checklist with completion tracking
- [ ] Photo upload for task completion
- [ ] Maintenance request form
- [ ] Maintenance request management (assign, track, resolve)
- [ ] Vendor directory
- [ ] Inventory tracking (basic)
- [ ] Push notifications to housekeeping staff

**Done criteria:** Housekeeper gets notified on phone when guest checks out. Marks task complete with photos. Manager sees status in real time.

---

## Phase 4: Guest CRM (Deferred — not needed for MVP)

**Goal:** Know your guests across all properties and channels.

**Deliverables:**
- [ ] Extend `guests` table (ID fields, full profile)
- [ ] GuestService with match logic
- [ ] Guest list + search page
- [ ] Guest profile page with stay history
- [ ] Guest tags (VIP, repeat, problematic)
- [ ] Blacklist functionality
- [ ] Link guests to reservations automatically on sync
- [ ] Guest notes

**Done criteria:** After 3 months of usage, can identify repeat guests and their stay history.

---

## Phase 5: Automation + Communication

**Goal:** Guest communication runs automatically without manual intervention.

**Deliverables:**
- [ ] Communication templates table
- [ ] WhatsApp Business API integration (via Interakt or Wati)
- [ ] Email via Resend
- [ ] 5 default automation triggers implemented
- [ ] Template editor in settings
- [ ] Communication log per reservation
- [ ] Manual message to guest
- [ ] Pre-arrival message with access code (if smart locks connected)

**Done criteria:** From booking to checkout, guest receives all 5 automated messages without manager doing anything.

---

## Phase 6: Revenue Intelligence + AI

**Goal:** AI-powered pricing and business insights.

**Deliverables:**
- [ ] Claude API integration
- [ ] Pricing recommendation agent
- [ ] Occupancy forecasting agent
- [ ] Expense anomaly detector
- [ ] AI insights dashboard panel
- [ ] Apply pricing recommendations to channels
- [ ] Occupancy forecast chart (30/60/90 days)
- [ ] Cash flow AI insights
- [ ] Pre-aggregated monthly stats table
- [ ] Advanced analytics dashboard (occupancy heatmap, channel performance)

**Done criteria:** AI generates weekly pricing recommendations. Manager applies one recommendation and it updates on Airbnb.

---

## Phase 7: Owner Portal 2.0

**Goal:** Property owners get full visibility without calling their PMC.

**Deliverables:**
- [ ] Owner statement auto-generation (monthly)
- [ ] Automated email delivery on 1st of month
- [ ] Owner portal dashboard (revenue, occupancy, expenses, upcoming stays)
- [ ] Property health score visible to owners
- [ ] Multi-property view for owners with multiple properties

**Done criteria:** Ananya (the investor persona) logs in, sees all 5 properties' October performance without calling her PMC.

---

## Phase 8: Enterprise SaaS

**Goal:** Proper multi-tenancy, billing, and API access.

**Deliverables:**
- [ ] Organizations table + migration
- [ ] Organization_members with proper role system
- [ ] Subscription plans + billing (Razorpay + Stripe)
- [ ] Plan limits enforcement (property count, user count)
- [ ] Feature flags system
- [ ] API key management
- [ ] REST API for external access
- [ ] Organization onboarding flow
- [ ] Team invitation system
- [ ] White label (Enterprise only)

**Done criteria:** A new PMC can sign up, create an org, invite their team, and start a 14-day trial without any manual intervention from Airaroots.

---

## Phase 9: AI Copilot

**Goal:** Conversational AI that answers business questions.

**Deliverables:**
- [ ] Natural language query interface
- [ ] Property health score
- [ ] Predictive maintenance alerts
- [ ] pgvector integration for semantic search
- [ ] AI copilot chat interface
- [ ] Voice query (stretch goal)

**Done criteria:** Vikram can ask "Which of my properties had the worst September?" and get a complete answer in seconds.

---

## Current State Gap Analysis

What exists vs. what Phase 1 needs:

| Requirement | Current State | Gap |
|-------------|--------------|-----|
| Reservation model | None | Build from scratch |
| Calendar view | None | Build from scratch |
| Conflict detection | None | Build from scratch |
| Revenue auto-derivation | Partial (CSV import) | Build event handler |
| Guest model | None | Build basic version |
| Channel sync | None | Phase 2 |
| Property settings (check-in time, etc.) | Minimal | Extend properties table |
| Background jobs | None | Build job queue |
| Domain event bus | None | Build event bus |
