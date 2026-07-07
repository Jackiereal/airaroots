# Functional Requirements

> Format: FR-[domain]-[number]: [requirement]
> Priority: P0 (must have), P1 (should have), P2 (nice to have)
> Phase: which product phase implements this

---

## FR-ORG: Organization Domain

| ID | Requirement | Priority | Phase |
|----|-------------|----------|-------|
| FR-ORG-01 | A user can create an organization | P0 | 8 |
| FR-ORG-02 | An organization has a name, slug, timezone, currency, and logo | P0 | 8 |
| FR-ORG-03 | An organization owner can invite members by email | P0 | 8 |
| FR-ORG-04 | Invited members receive an email with a signup/join link | P0 | 8 |
| FR-ORG-05 | Organization members have roles: owner, admin, manager, viewer | P0 | 8 |
| FR-ORG-06 | An organization owner can remove members | P0 | 8 |
| FR-ORG-07 | A user can belong to multiple organizations | P1 | 8 |
| FR-ORG-08 | Switching between organizations changes the data context | P0 | 8 |
| FR-ORG-09 | Organization settings control default timezone, currency, and language | P1 | 8 |

---

## FR-AUTH: Authentication Domain

| ID | Requirement | Priority | Phase |
|----|-------------|----------|-------|
| FR-AUTH-01 | Users can sign in with email + password | P0 | Done |
| FR-AUTH-02 | Users can sign in with Google OAuth | P1 | 8 |
| FR-AUTH-03 | Admins can invite users directly | P0 | Done |
| FR-AUTH-04 | Password reset via email | P0 | Done |
| FR-AUTH-05 | Sessions expire after 7 days of inactivity | P0 | Done |
| FR-AUTH-06 | MFA via TOTP (authenticator app) | P1 | 8 |
| FR-AUTH-07 | Audit log records every login | P1 | 1 |

---

## FR-PROP: Property Domain

| ID | Requirement | Priority | Phase |
|----|-------------|----------|-------|
| FR-PROP-01 | Admin can create a property with name, address, platform | P0 | Done |
| FR-PROP-02 | Property has settings: check-in time, check-out time, min/max nights | P0 | 1 |
| FR-PROP-03 | Property has bedroom, bathroom, and max guest count | P0 | 1 |
| FR-PROP-04 | Property can be deactivated without deleting | P1 | 1 |
| FR-PROP-05 | Property has multiple photos with a cover image | P2 | 3 |
| FR-PROP-06 | Property has a list of amenities | P2 | 3 |
| FR-PROP-07 | Property can have multiple owners with ownership percentage | P0 | Done |
| FR-PROP-08 | Property has a base nightly rate and optional weekend rate | P0 | 1 |
| FR-PROP-09 | Clients (owners) see only their assigned properties | P0 | Done |

---

## FR-RES: Reservation Domain

| ID | Requirement | Priority | Phase |
|----|-------------|----------|-------|
| FR-RES-01 | Admin can create a manual reservation for any property | P0 | 1 |
| FR-RES-02 | Reservation has: guest, property, channel, check-in, check-out, rates | P0 | 1 |
| FR-RES-03 | Reservation status machine: inquiry → confirmed → checked_in → checked_out → cancelled | P0 | 1 |
| FR-RES-04 | System prevents overlapping reservations on same property | P0 | 1 |
| FR-RES-05 | Reservation can be modified (dates, rates) with audit trail | P0 | 1 |
| FR-RES-06 | Reservation can be cancelled with reason | P0 | 1 |
| FR-RES-07 | Airbnb reservations are synced automatically via API | P0 | 2 |
| FR-RES-08 | Booking.com reservations are synced automatically via API | P0 | 2 |
| FR-RES-09 | Reservation detail shows: guest info, dates, rates, finance breakdown | P0 | 1 |
| FR-RES-10 | Reservation notes (internal, not visible to guest) | P1 | 1 |
| FR-RES-11 | Reservation has platform booking ID for deduplication | P0 | 2 |
| FR-RES-12 | Reservation cancellation triggers downstream cleanup (finance, housekeeping) | P0 | 2 |
| FR-RES-13 | Bulk reservation import via CSV | P2 | 8 |

---

## FR-CAL: Calendar Domain

| ID | Requirement | Priority | Phase |
|----|-------------|----------|-------|
| FR-CAL-01 | Multi-property calendar: see all properties in one timeline view | P0 | 1 |
| FR-CAL-02 | Month view and week view | P0 | 1 |
| FR-CAL-03 | Timeline view (Gantt-style, multi-property rows) | P0 | 1 |
| FR-CAL-04 | Color reservations by channel (Airbnb = orange, Booking.com = blue, Direct = green) | P0 | 1 |
| FR-CAL-05 | Block dates manually (owner hold, maintenance, etc.) | P0 | 1 |
| FR-CAL-06 | Drag-and-drop to modify reservation dates | P1 | 1 |
| FR-CAL-07 | Click reservation to open detail panel | P0 | 1 |
| FR-CAL-08 | Filter calendar by property, channel, status | P1 | 1 |
| FR-CAL-09 | Sync calendar to iCal / Google Calendar (export) | P2 | 2 |
| FR-CAL-10 | Calendar shows property occupancy % per month in header | P1 | 1 |
| FR-CAL-11 | Mini map showing availability across all properties | P2 | 3 |

---

## FR-GUEST: Guest Domain

| ID | Requirement | Priority | Phase |
|----|-------------|----------|-------|
| FR-GUEST-01 | Guest record auto-created or matched on reservation creation | P0 | 3 |
| FR-GUEST-02 | Guest profile: name, email, phone, country, ID details | P0 | 3 |
| FR-GUEST-03 | Guest stay history across all properties | P0 | 3 |
| FR-GUEST-04 | Guest tags: VIP, repeat, problematic | P1 | 3 |
| FR-GUEST-05 | Internal notes on guest | P1 | 3 |
| FR-GUEST-06 | Guest blacklist with reason | P1 | 3 |
| FR-GUEST-07 | Guest search across name, email, phone | P0 | 3 |
| FR-GUEST-08 | Guest review from channel linked to guest profile | P2 | 3 |

---

## FR-FIN: Finance Domain

| ID | Requirement | Priority | Phase |
|----|-------------|----------|-------|
| FR-FIN-01 | Revenue auto-derived from confirmed reservations | P0 | 1 |
| FR-FIN-02 | Expenses: add, edit, categorize, period | P0 | Done |
| FR-FIN-03 | Expense categories: maintenance, utility, staff, platform fee, insurance, etc. | P0 | Done |
| FR-FIN-04 | Out-of-pocket expenses tracked per owner | P0 | Done |
| FR-FIN-05 | P&L report: revenue minus expenses by month | P0 | Done |
| FR-FIN-06 | Loan tracking: principal, rate, tenure, EMI schedule | P0 | Done |
| FR-FIN-07 | Cash flow projections | P0 | Done |
| FR-FIN-08 | Airbnb payout CSV import | P0 | Done |
| FR-FIN-09 | Business valuation calculator | P1 | Done |
| FR-FIN-10 | Marketing ROI simulator | P1 | Done |
| FR-FIN-11 | Revenue engine: gross, net, platform commission, taxes | P0 | 1 |
| FR-FIN-12 | Multi-property financial summary | P0 | Done |
| FR-FIN-13 | Export reports to PDF and CSV | P1 | Done |
| FR-FIN-14 | Booking.com payout import | P1 | 2 |
| FR-FIN-15 | Owner statement report (PMC → owner) | P0 | 7 |

---

## FR-OPS: Operations Domain

| ID | Requirement | Priority | Phase |
|----|-------------|----------|-------|
| FR-OPS-01 | Housekeeping tasks auto-created on checkout | P0 | 4 |
| FR-OPS-02 | Housekeeping task: type (checkout, mid-stay, inspection), assignee, scheduled time | P0 | 4 |
| FR-OPS-03 | Housekeeping staff app: view tasks, complete checklist, upload photos | P0 | 4 |
| FR-OPS-04 | Manager sees real-time housekeeping status per property | P0 | 4 |
| FR-OPS-05 | Maintenance request: title, description, priority, photos | P0 | 4 |
| FR-OPS-06 | Maintenance request assigned to staff or vendor | P0 | 4 |
| FR-OPS-07 | Maintenance status: reported → assigned → in_progress → resolved | P0 | 4 |
| FR-OPS-08 | Maintenance history per property | P0 | 4 |
| FR-OPS-09 | Inventory items per property with quantity tracking | P1 | 4 |
| FR-OPS-10 | Inventory reorder alerts | P2 | 4 |
| FR-OPS-11 | Vendor directory: name, category, phone, rate | P1 | 4 |
| FR-OPS-12 | Staff scheduling | P2 | 4 |

---

## FR-COMM: Communication Domain

| ID | Requirement | Priority | Phase |
|----|-------------|----------|-------|
| FR-COMM-01 | WhatsApp message templates per trigger event | P0 | 5 |
| FR-COMM-02 | Email templates per trigger event | P0 | 5 |
| FR-COMM-03 | Automated triggers: booking confirmation, pre-arrival (48hr), check-in, checkout, review request | P0 | 5 |
| FR-COMM-04 | Template variables: guest name, property name, dates, check-in code | P0 | 5 |
| FR-COMM-05 | Manual message to guest from reservation page | P1 | 5 |
| FR-COMM-06 | Communication log per reservation | P0 | 5 |
| FR-COMM-07 | SMS as fallback when WhatsApp fails | P2 | 5 |
| FR-COMM-08 | Push notifications to staff for task assignments | P0 | 4 |

---

## FR-AI: AI Domain

| ID | Requirement | Priority | Phase |
|----|-------------|----------|-------|
| FR-AI-01 | Pricing recommendations per property per date range | P0 | 6 |
| FR-AI-02 | Occupancy forecast: 30/60/90 day prediction | P0 | 6 |
| FR-AI-03 | Expense anomaly detection: flag unusual expenses | P1 | 6 |
| FR-AI-04 | Property health score (0–100) based on occupancy, reviews, maintenance | P1 | 9 |
| FR-AI-05 | Natural language query: "What was my revenue in Q3?" | P1 | 9 |
| FR-AI-06 | Cash flow insights: "At current pace you'll be cash negative in 60 days" | P1 | 9 |
| FR-AI-07 | AI never writes or updates data without user approval | P0 | 6 |

---

## FR-BILLING: Billing Domain

| ID | Requirement | Priority | Phase |
|----|-------------|----------|-------|
| FR-BILL-01 | Subscription plan selection during onboarding | P0 | 8 |
| FR-BILL-02 | Razorpay payment for Indian customers | P0 | 8 |
| FR-BILL-03 | Stripe payment for international customers | P1 | 8 |
| FR-BILL-04 | Automatic invoice generation per billing cycle | P0 | 8 |
| FR-BILL-05 | Usage limits enforced per plan (properties, users) | P0 | 8 |
| FR-BILL-06 | Upgrade/downgrade plan | P0 | 8 |
| FR-BILL-07 | 14-day free trial | P0 | 8 |
| FR-BILL-08 | Cancel subscription with data retention | P0 | 8 |
