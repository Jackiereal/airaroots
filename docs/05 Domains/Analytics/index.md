# Analytics & Reports Domain

> Phase: Existing (partial) + Phase 6 (advanced)
> Status: Basic charts built

---

## Overview

Analytics aggregates data from all domains to produce business intelligence: occupancy rates, revenue trends, ADR, RevPAR, expense analysis, and comparative benchmarks. Most analytics are read-only aggregations — no writes.

---

## Key Metrics

### Revenue Metrics
| Metric | Formula |
|--------|---------|
| Gross Revenue | SUM(reservations.gross_revenue) |
| Net Revenue | SUM(reservations.net_payout) |
| ADR (Average Daily Rate) | Gross Revenue / Booked Nights |
| RevPAR (Revenue Per Available Room) | Gross Revenue / Available Nights |
| Platform Commission % | SUM(commission) / Gross Revenue × 100 |

### Occupancy Metrics
| Metric | Formula |
|--------|---------|
| Occupancy Rate | Booked Nights / Available Nights × 100 |
| Available Nights | Days in Period (excl. owner holds, maintenance) |
| Average Length of Stay | Total Nights / Reservation Count |
| Booking Lead Time | AVG(reservation.created_at - reservation.check_in) |

### Channel Metrics
| Metric | Formula |
|--------|---------|
| Channel Mix % | Revenue by channel / Total Revenue × 100 |
| Airbnb ADR vs Direct ADR | Compare ADR per channel |
| Commission Drag | How much revenue lost to platform fees |

---

## Existing Analytics Components

Current built components (keep, extend):
- `FinanceDashboard` — monthly revenue/expense summary
- `RevenueEngine` — revenue breakdown by source
- `CashFlowProjections` — 12-month cash flow forecast
- `BusinessValuation` — property valuation calculator
- `MarketingSimulator` — marketing ROI calculator
- `PricingSimulator` — pricing scenario tool
- `BreakevenCalculator` — breakeven analysis

---

## Phase 6 Analytics Additions

### Occupancy Heatmap
Visual calendar heatmap showing occupancy rate by month for the past 2 years. Identifies seasonal patterns.

### Revenue Trend Chart
12-month rolling revenue with channel breakdown. Month-over-month % change.

### Property Benchmarking
Compare properties in the same portfolio against each other. Identify underperformers.

### Channel Performance
ADR, occupancy, and net revenue by channel. Helps decide where to focus inventory.

### Guest Analytics
- New vs repeat guests over time
- Geographic breakdown of guests
- Average spend per guest

---

## Aggregation Strategy

Analytics queries are expensive. Mitigations:

1. **Materialized summary tables** — Pre-aggregate monthly metrics into `property_monthly_stats` table. Refresh nightly.
2. **Cache at API layer** — 5-minute cache for summary endpoints
3. **Date range limits** — Max 24 months lookback for standard queries
4. **Background calculation** — Never compute complex analytics on request; use pre-computed values

```sql
-- Pre-aggregated monthly stats table (Phase 6)
CREATE TABLE property_monthly_stats (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id   uuid NOT NULL,
  property_id       uuid NOT NULL,
  period_month      date NOT NULL,
  gross_revenue     numeric(14,2) DEFAULT 0,
  net_revenue       numeric(14,2) DEFAULT 0,
  total_expenses    numeric(14,2) DEFAULT 0,
  net_profit        numeric(14,2) DEFAULT 0,
  nights_booked     int DEFAULT 0,
  nights_available  int DEFAULT 0,
  occupancy_rate    numeric(5,2) DEFAULT 0,
  adr               numeric(14,2) DEFAULT 0,
  revpar            numeric(14,2) DEFAULT 0,
  reservation_count int DEFAULT 0,
  airbnb_revenue    numeric(14,2) DEFAULT 0,
  direct_revenue    numeric(14,2) DEFAULT 0,
  booking_com_revenue numeric(14,2) DEFAULT 0,
  calculated_at     timestamptz DEFAULT now(),
  UNIQUE (property_id, period_month)
);
```

---

## API Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/analytics/summary | Portfolio summary for org |
| GET | /api/analytics/properties/:id/monthly | Monthly stats for property |
| GET | /api/analytics/properties/:id/occupancy | Occupancy trend |
| GET | /api/analytics/properties/:id/revenue | Revenue breakdown |
| GET | /api/analytics/properties/:id/channels | Channel performance |
| GET | /api/analytics/benchmarks | Multi-property comparison |
