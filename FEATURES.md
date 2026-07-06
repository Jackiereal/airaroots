# Airaroots — Features & Capabilities

Airaroots is a full-stack short-term rental property management platform. It serves two user types: **admins** (property managers) and **clients** (property owners). The platform handles end-to-end property management, financial tracking, and owner reporting.

---

## Authentication & Access Control

- Supabase-based auth with email/password sign-in
- OAuth callback flow via `/auth/callback`
- Role-based routing on login: admins go to `/dashboard`, clients go to `/client/dashboard`
- Property-level access control via `property_access` table — admins assign clients to specific properties
- Admin user management panel at `/admin/users`

---

## Admin Portal

### Dashboard (`/dashboard`)
- Lists all properties with name and address
- One-click navigation to each property's P&L view
- "Add Property" shortcut

### Property Management (`/properties`)
- Create and manage properties (name, slug, address)
- Assign owners (via `/api/properties/[propertyId]/owners`)

### User Management (`/admin/users`)
- View and manage all platform users
- Assign property access to client users

---

## Client (Owner) Portal

### Dashboard (`/client/dashboard`)
- Shows properties the owner has been granted access to
- Direct link to each property's financial view

### Property Finance View (`/client/properties/[propertyId]`)
- Read-only access to the full finance dashboard for assigned properties

---

## Property Finance Module

Each property has a comprehensive finance section with multiple tabs.

### Finance Dashboard (Overview Tab)

**Hospitality KPI Cards**
- ADR (Average Daily Rate)
- RevPAR (Revenue per Available Night)
- Occupancy % and total nights booked
- Average length of stay
- Average booking value
- Booking count
- Annual revenue and annual profit
- Net cash flow (Revenue - Expenses - EMIs)

**Loan Snapshot**
- Total outstanding loan balance
- Total monthly EMI
- Per-loan breakdown with debt-free date

**Charts**
- Revenue vs Expenses bar chart (9-month trend)
- Net Cash Flow line chart (9-month trend)

---

### Revenue Engine

Tracks all revenue sources per property per month.

**Revenue Sources**
- Airbnb (auto-imported from CSV)
- Direct bookings
- Corporate events, birthday parties, photography shoots
- Workshops, day outings, BBQ packages
- Breakfast, extra guest charges, cleaning fees
- Late checkout, early check-in, security deposits
- Gift vouchers, other

**Features**
- Add / edit / delete manual revenue entries
- Per-source monthly and annual totals
- Month-over-month growth percentage
- Contribution percentage per source
- Tabular breakdown by source

---

### Expense Engine

Tracks all property expenses per month.

**Features**
- Add / edit / delete expense entries with date, type, amount, notes
- `paid_from` tracking (who paid the expense)
- Category grouping with hierarchical labels (`Category / Sub-category`)
- View mode toggle: monthly / quarterly / yearly
- Pie chart: expense distribution by category
- Bar chart: category comparison
- Line chart: expense trend over time
- Out-of-pocket expense tracking (separate endpoint)

---

### Revenue Import (Airbnb CSV)

- Upload Airbnb payout CSV to auto-populate revenue data
- Parses and maps Airbnb row data per booking
- Edit / delete individual imported rows
- API: `/api/finance/[propertyId]/import`

---

### Direct Bookings

- Add and manage direct (non-Airbnb) bookings
- Upcoming bookings view (`/api/finance/[propertyId]/direct-bookings/upcoming`)
- Full CRUD via API

---

### Loan Manager

Tracks property loans with full amortization.

**Loan Types**
- Gold loan, personal loan, business loan, home loan, partner loan

**Per-Loan Data**
- Principal, interest rate, tenure, start date
- Processing fee, insurance amount
- EMI override (manual override if needed)
- Prepayment penalty percentage
- Extra payment support
- Notes

**Features**
- Auto-computed EMI from principal / rate / tenure
- Full amortization schedule (opening balance, principal, interest, closing balance per month)
- Loan summary: outstanding principal, principal paid, interest paid, remaining interest, debt-free date
- Active/inactive loan toggle
- Expandable schedule view per loan

---

## Planning Hub

A financial planning suite with 7 sub-tools, all seeded from real historical data.

### 1. Cash Flow Projections
- 12-month forward projection
- Inputs: nightly rate, occupancy %, monthly expenses, EMIs, extra monthly revenue
- Auto-fills from historical averages
- Outputs: revenue, expenses, EMI, net cash flow per month
- Cumulative cash flow line
- Chart: composed bar + line (revenue vs expenses vs net)

### 2. Breakeven Calculator
- Calculates months to recover initial investment
- Inputs: monthly revenue, monthly expenses, initial investment
- Factors in active loan EMIs and balances
- Monthly simulation table: revenue, expenses, EMI, net, loan balance, cumulative
- Chart: stacked bar (expenses + EMI) vs revenue line, with breakeven marker
- Highlights breakeven month

### 3. Debt-Free Planner
- Shows projected debt-free date across all active loans
- Models effect of extra monthly payments
- Visualizes principal paydown over time

### 4. Pricing Simulator
- Simulate impact of changing nightly rate
- Projects revenue at different occupancy levels
- Helps find optimal price/occupancy combination

### 5. Business Valuation
- Multiple valuation methods:
  - Revenue multiple
  - EBITDA multiple
  - DCF (discounted cash flow with growth rate and discount rate)
  - Asset-based (land area in cents x rate per cent + construction value)
- Inputs auto-seeded from historical averages and active loans
- Configurable: projection years, growth rate, discount rate
- Save valuation config to database

### 6. Marketing Simulator
- Simulate impact of adding or scaling marketing channels
- Model revenue uplift from different booking sources

### 7. AI Advisor (Recommendations Panel)
- Rule-based + AI-generated recommendations
- Categories: pricing, marketing, debt, investment, operations, cash flow
- Confidence levels: high / medium / low
- Each recommendation includes: title, description, reason, impact, and action
- Source badge distinguishes rule-based vs AI-generated

---

## Activity Feed

- Per-property activity log
- API: `/api/finance/[propertyId]/activity`

---

## Reports & Export

- PDF export via `jspdf` + `jspdf-autotable`
- CSV parsing via `papaparse` (Airbnb import)

---

## Data & Infrastructure

- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth with SSR support (`@supabase/ssr`)
- **Framework**: Next.js 16 (App Router)
- **Charts**: Recharts (bar, line, area, pie, composed)
- **UI**: Radix UI primitives (Dialog, Tabs, Select, DropdownMenu, Label)
- **Styling**: Tailwind CSS v4 with CSS custom properties for theming
- **Currency**: INR (Indian Rupee) throughout

---

## Tech Stack Summary

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| Charts | Recharts |
| UI Primitives | Radix UI |
| Styling | Tailwind CSS v4 |
| PDF Export | jsPDF + jspdf-autotable |
| CSV Parsing | PapaParse |
| Date Utils | date-fns |
