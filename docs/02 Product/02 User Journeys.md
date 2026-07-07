# User Journeys

---

## Journey 1: New Organization Onboarding

**Actor:** Priya (PMC Operations Manager)
**Goal:** Get her 40-property operation live on Airaroots

```
Step 1: Sign Up
  Priya creates an account at airaroots.com
  System creates: user_profiles record + default organization + admin membership
  System enables: Starter trial (14 days)

Step 2: Create Organization
  Priya sets org name, timezone, currency (INR)
  System creates: organizations record with defaults

Step 3: Add First Property
  Priya adds "Sea Breeze Villa, Anjuna"
  Inputs: name, address, bedrooms, bathrooms, max guests
  System creates: properties record linked to organization

Step 4: Connect Airbnb
  Priya connects her Airbnb account via OAuth
  System creates: channel_connections record
  Background job: Imports last 90 days of reservations
  System creates: reservations records from Airbnb history

Step 5: Import Historical Finance
  Priya uploads Airbnb earnings CSV (6 months)
  System creates: property_finance_airbnb_rows records
  System auto-derives: revenue_entries from parsed CSV

Step 6: Invite Team
  Priya invites her 3 managers as "manager" role
  System sends: invitation emails with signup links

Step 7: Add Remaining Properties
  Priya repeats Steps 3–4 for all 40 properties
  (Or uses bulk import CSV — Phase 8 feature)

Outcome: Full portfolio visible. Historical data imported. Team invited.
Time target: 2 hours for 40 properties.
```

---

## Journey 2: New Booking Arrives (Airbnb)

**Actor:** System (automated), Priya (notified)
**Trigger:** Guest books on Airbnb

```
T+0s   Airbnb sends webhook to Airaroots
T+1s   Webhook handler validates and queues event
T+2s   Background job processes: creates/updates reservation record
T+3s   System runs conflict detection (no overlapping reservations)
T+5s   Finance: creates revenue_entry derived from booking amount
T+5s   Calendar: marks dates as blocked
T+10s  Housekeeping: creates checkout cleaning task for departure date
T+10s  Communication: queues booking confirmation message to guest
T+15s  Push notification to Priya: "New booking: Sea Breeze Villa, 3 nights, ₹18,000"
T+30s  Guest receives: WhatsApp "Thanks for booking! Here's what to expect..."

Priya opens dashboard → sees reservation in calendar → no action required
```

---

## Journey 3: Manual Reservation (Direct Booking)

**Actor:** Priya
**Goal:** Add a direct booking taken via phone/Instagram

```
Step 1: Open Calendar
  Priya opens multi-property calendar
  Sees availability for Sea Breeze Villa, desired dates

Step 2: Create Reservation
  Clicks on start date
  Modal opens: reservation creation form
  Fills: guest name, phone, email, check-in, check-out, rate, notes
  Selects: channel = "Direct"

Step 3: System Validates
  Checks for conflicts: no overlapping reservation exists
  Checks minimum stay rules

Step 4: System Creates
  Creates: reservation record
  Creates: guest record (or links existing guest)
  Creates: revenue_entry from booking amount
  Blocks: calendar dates
  Creates: housekeeping task for checkout date

Step 5: Communication
  Priya clicks "Send Booking Confirmation"
  System sends WhatsApp with booking details and check-in instructions

Outcome: Reservation live in system. Calendar blocked. Guest messaged. Finance updated.
```

---

## Journey 4: Housekeeping Workflow

**Actor:** Deepak (housekeeper), Priya (manager)
**Trigger:** Guest checks out

```
T+0    Checkout time (11am)
T+0    System marks reservation status: "checked_out"
T+1min System creates housekeeping_task: "Clean Sea Breeze Villa — Checkout Clean"
       Task includes: checklist items, check-in time for next guest (3pm same day)

T+5min Deepak receives push notification: "New task: Sea Breeze Villa checkout clean"
T+5min Deepak opens mobile app → sees task details and checklist

T+11am Deepak arrives at property
T+11am Deepak marks task: "Started"

T+1pm  Deepak completes checklist items one by one
T+1pm  Deepak photographs: bed, bathroom, kitchen, living room
T+1pm  Deepak marks task: "Complete"

T+1pm  Priya receives notification: "Sea Breeze Villa — Housekeeping Complete — View photos"
T+1pm  Calendar shows property: "Ready for next guest"

T+2pm  During cleaning, Deepak notices broken shower head
T+2pm  Deepak creates maintenance request: "Broken shower head, bathroom"
T+2pm  Uploads photo
T+2pm  Priya receives: "Maintenance issue reported at Sea Breeze Villa"

Outcome: Property ready on time. Maintenance issue logged. Photos as proof.
```

---

## Journey 5: Month-End Owner Report

**Actor:** System (automated), Vikram (PMC owner), Ananya (property owner)
**Trigger:** 1st of each month

```
T+0    Background job triggers at midnight on 1st of month
T+0    For each property:
         Aggregates: total revenue (from revenue_entries)
         Aggregates: total expenses (from property_finance_expenses)
         Calculates: net income, occupancy rate, ADR, RevPAR
         Compares: vs previous month, vs same month last year

T+1min System generates: owner_report record for each property
T+1min System sends: email to Ananya with her portfolio summary
T+1min Ananya receives: "October Report — Sea Breeze Villa — ₹2,14,000 revenue, 78% occupancy"

T+5min Vikram opens dashboard: sees all 40 properties' October performance
T+5min Vikram sees AI insight: "3 properties underperformed by >20% vs. market. Tap for recommendations."

No manual work required from Priya or Vikram.
```

---

## Journey 6: Conflict Detection

**Actor:** System (automated), Priya (resolved)
**Trigger:** Attempt to create overlapping reservation

```
Scenario: Priya creates a direct booking for Oct 5–8
          Airbnb also syncs a booking for Oct 6–9 from a separate account

T+0    Priya creates direct booking Oct 5–8 (succeeds)
T+1hr  Airbnb webhook arrives with booking Oct 6–9
T+1hr  System detects conflict: Oct 6–8 already blocked
T+1hr  System creates: reservation with status = "conflict"
T+1hr  System creates: conflict_alert record
T+1hr  Priya receives: "Booking conflict detected — Sea Breeze Villa Oct 6–9 vs Oct 5–8"

Priya opens conflict resolution screen:
  Sees both reservations side by side
  Options: Cancel direct booking, or cancel Airbnb (will trigger platform cancellation)
  Priya selects: Cancel Airbnb booking
  System: updates reservation status, sends cancellation to Airbnb via API
  System: logs conflict resolution in audit_log
```

---

## Journey 7: AI Pricing Recommendation

**Actor:** AI system, Vikram (reviews recommendations)
**Trigger:** Weekly AI analysis job

```
T+0    Weekly job runs pricing analysis for all properties
T+0    For Sea Breeze Villa for next 30 days:
         Fetches: current rates set on Airbnb
         Fetches: competitor rates via market data (Phase 6)
         Fetches: occupancy forecast for next 30 days
         Fetches: historical booking patterns

T+1min AI model generates recommendations:
         Oct 15-17 (weekend): Current ₹8,000 → Recommended ₹10,500 (+31%)
         Oct 20-22 (long weekend): Current ₹9,000 → Recommended ₹14,000 (+56%)
         Oct 28-31 (Diwali): Current ₹10,000 → Recommended ₹18,000 (+80%)

T+1min System creates: ai_pricing_recommendations records with confidence scores

Vikram opens AI dashboard:
  Sees table of recommendations sorted by impact
  Clicks "Apply" on Diwali recommendation
  System: pushes rate change to Airbnb via channel API
  System: logs action, marks recommendation as applied
```

---

## Journey 8: Subscription Upgrade

**Actor:** Vikram
**Trigger:** Property count exceeds Starter plan limit

```
T+0    Vikram adds 6th property
T+0    System detects: plan limit (5 properties) exceeded
T+0    System shows: upgrade prompt "You've reached your property limit"

Vikram clicks "Upgrade to Growth Plan":
  Sees plan comparison
  Selects: Growth (up to 25 properties, ₹7,999/month)
  Enters payment: Razorpay UPI

System:
  Creates: invoice record
  Processes: payment via Razorpay
  Updates: subscription record (plan_id, period)
  Enables: feature flags for Growth-tier features
  Vikram sees: "Upgraded successfully — 25 properties now available"
```
