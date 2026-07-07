# Milestones

---

## Milestone Definition

A milestone is a demoable, working feature that can be shown to a real user. Not "code written" but "user can complete a workflow."

---

## M1: First Reservation

**Phase:** 1
**Target:** End of week 1

User can:
1. Open the dashboard
2. Navigate to "Reservations"
3. Click "New Reservation"
4. Fill in: property, guest name, dates, channel, rate
5. Submit → see it appear in list
6. Open reservation detail → see finance summary

Database: `reservations` table created. Basic CRUD working.

---

## M2: Working Calendar

**Phase:** 1
**Target:** End of week 2

User can:
1. Open calendar page
2. See all reservations for all properties in a timeline view
3. Click a reservation → see detail panel slide in
4. Click an empty date → create a reservation or block dates
5. See different colors per channel

---

## M3: Finance Auto-Derivation

**Phase:** 1
**Target:** End of week 3

When a reservation is created:
- Revenue entry automatically created
- Finance summary for that month updates
- Existing P&L dashboard shows reservation revenue alongside manual entries

---

## M4: Full Phase 1

**Phase:** 1
**Target:** End of week 5

All Phase 1 deliverables complete:
- Reservation CRUD (create, edit, cancel, check-in, check-out)
- Multi-property calendar (timeline + month)
- Block dates (owner hold, maintenance)
- Conflict detection working
- Finance auto-derivation working
- Properties table extended with new fields

---

## M5: First Channel Connected

**Phase:** 2
**Target:** End of week 7

User can:
1. Go to Settings → Channels
2. Enter their Airbnb iCal URL
3. Click "Sync Now"
4. See existing Airbnb bookings appear in calendar
5. Sync runs automatically every 15 minutes

---

## M6: Phase 2 Complete

**Phase:** 2
**Target:** End of week 9

- Both Airbnb and Booking.com iCal sync working
- Webhook handlers live (for when API approved)
- Conflict detection between channels working
- iCal export for Google Calendar working

---

## M7: Guest CRM Live (Phase 3)

**Target:** End of week 11

- Guest profiles auto-created from reservations
- Guest list with search
- Guest profile shows stay history
- Tags and notes working

---

## M8: Housekeeping Live (Phase 4)

**Target:** End of week 15

- Housekeeping tasks auto-created on checkout
- Staff can see and complete tasks on mobile
- Photo upload working
- Manager sees real-time status

---

## M9: Communication Live (Phase 5)

**Target:** End of week 18

- Booking confirmation WhatsApp sent automatically
- Pre-arrival message sent 48 hours before check-in
- Review request sent 24 hours after checkout
- Manager can see communication log per reservation

---

## M10: AI Insights Live (Phase 6)

**Target:** End of week 22

- AI pricing recommendations generated weekly
- Occupancy forecast visible on dashboard
- Manager can apply pricing recommendation to channel

---

## M11: Owner Portal Live (Phase 7)

**Target:** End of week 25

- Month-end report auto-generated and emailed
- Owner can log in and see their property dashboard
- Health score visible

---

## M12: Organizations + Billing Live (Phase 8)

**Target:** End of week 32

- New user can sign up, create org, subscribe
- 14-day trial working
- Razorpay payment working
- Property/user limits enforced by plan

---

## Definition of Done (per milestone)

A milestone is done when:
1. Feature works end-to-end with real data
2. No P0 or P1 bugs
3. Works on mobile (375px screen)
4. Loading states shown
5. Error states handled with helpful messages
6. Unit tests passing for domain services
7. No console errors or TypeScript errors
8. Manually tested on staging with realistic data
