# Finance Domain

> Phase: Existing (partial) + Phase 1 (reservation-derived revenue)
> Status: Partially built — expenses, Airbnb CSV import, loans, projections

---

## Overview

The Finance domain manages all financial records for properties. The critical architectural shift in Phase 1: **revenue must be derived automatically from reservations**, not entered manually.

Existing finance functionality (expenses, loans, projections) is preserved and extended.

---

## Existing Entities (Keep)

### PropertyFinanceExpense
Manual expense entries per property per period.

### PropertyFinanceAirbnbRow
Raw rows from Airbnb CSV import. Legacy path — being replaced by API sync in Phase 2.

### PropertyFinanceDirectBooking
Legacy direct booking records. New direct bookings should use `reservations` table.

### PropertyFinanceLoan
Loan records with EMI calculations.

---

## New Entities (Phase 1)

### RevenueEntry (NEW)

Auto-created from reservation events. **Never manually created or edited by users.**

| Field | Type | Description |
|-------|------|-------------|
| id | uuid | |
| organization_id | uuid | |
| property_id | uuid | |
| reservation_id | uuid | 1:1 link to reservation |
| period_month | date | First day of the billing month |
| source | enum | airbnb, booking_com, direct, vrbo, other |
| gross_revenue | decimal | Total before commission |
| platform_commission | decimal | Channel fee |
| cleaning_fee | decimal | Cleaning fee revenue |
| taxes | decimal | Taxes collected |
| net_revenue | decimal | What owner actually receives |
| nights | int | |
| adr | decimal | gross_revenue / nights (ADR) |
| status | enum | confirmed, voided |

---

## Service Interface

```typescript
interface FinanceService {
  // Revenue (auto-managed, not user-initiated)
  createRevenueEntry(reservationId: string): Promise<RevenueEntry>;
  updateRevenueEntry(reservationId: string): Promise<RevenueEntry>;
  voidRevenueEntry(reservationId: string, reason: string): Promise<void>;

  // Finance summary
  getSummary(propertyId: string, periodMonth: Date): Promise<FinanceSummary>;
  getMultiPropertySummary(orgId: string, periodMonth: Date): Promise<FinanceSummary[]>;
  getAnnualSummary(propertyId: string, year: number): Promise<AnnualSummary>;

  // Expenses
  createExpense(input: CreateExpenseInput, actorId: string): Promise<Expense>;
  updateExpense(id: string, input: UpdateExpenseInput): Promise<Expense>;
  deleteExpense(id: string): Promise<void>;
  getExpenses(propertyId: string, periodMonth: Date): Promise<Expense[]>;

  // Loans
  createLoan(input: CreateLoanInput): Promise<Loan>;
  getLoanSchedule(loanId: string): Promise<EMISchedule>;

  // Legacy
  importAirbnbCSV(propertyId: string, csvContent: string, actorId: string): Promise<ImportResult>;
}

type FinanceSummary = {
  propertyId: string;
  periodMonth: string;
  grossRevenue: number;
  netRevenue: number;
  totalExpenses: number;
  netProfit: number;
  occupancyRate: number;
  adr: number;     // Average Daily Rate
  revpar: number;  // Revenue Per Available Room
  nights: number;
  reservationCount: number;
  breakdown: {
    airbnbRevenue: number;
    bookingComRevenue: number;
    directRevenue: number;
  };
};
```

---

## Revenue Auto-Derivation

When `reservation.created` event fires:

```typescript
// src/domains/finance/event-handlers/finance.handler.ts

export const FinanceEventHandlers = {
  onReservationCreated: async (event: DomainEvent<{ reservation: Reservation }>) => {
    const { reservation } = event.payload;
    await financeService.createRevenueEntry(reservation.id);
  },

  onReservationModified: async (event: DomainEvent) => {
    const { reservation } = event.payload.new;
    await financeService.updateRevenueEntry(reservation.id);
  },

  onReservationCancelled: async (event: DomainEvent) => {
    const { reservation } = event.payload;
    await financeService.voidRevenueEntry(reservation.id, 'Reservation cancelled');
  },
};
```

Revenue entry creation:
```typescript
async createRevenueEntry(reservationId: string): Promise<RevenueEntry> {
  const reservation = await reservationRepository.findById(reservationId);
  if (!reservation) throw new NotFoundError('Reservation', reservationId);

  const periodMonth = startOfMonth(new Date(reservation.checkIn));

  return await revenueRepository.create({
    organizationId: reservation.organizationId,
    propertyId: reservation.propertyId,
    reservationId: reservation.id,
    periodMonth,
    source: reservation.channel as RevenueSource,
    grossRevenue: reservation.grossRevenue,
    platformCommission: reservation.platformCommission,
    cleaningFee: reservation.cleaningFee,
    taxes: reservation.taxes,
    netRevenue: reservation.netPayout,
    nights: reservation.nights,
    adr: reservation.nights > 0 ? reservation.grossRevenue / reservation.nights : 0,
    status: 'confirmed',
  });
}
```

---

## P&L Calculation

```
Monthly P&L per property:
  Gross Revenue = SUM(revenue_entries.gross_revenue WHERE period_month = X)
  Net Revenue   = SUM(revenue_entries.net_revenue WHERE period_month = X)
  Expenses      = SUM(property_finance_expenses.amount WHERE period_month = X)
  Net Profit    = Net Revenue - Expenses
  Occupancy     = Nights Booked / Days in Month × 100
  ADR           = Gross Revenue / Nights Booked
  RevPAR        = Gross Revenue / Days in Month
```

---

## Existing Finance Module Preservation

The existing `RevenueEngine`, `ExpenseEngine`, `CashFlowProjections`, `LoanManager`, etc. components remain unchanged. Phase 1 adds the `RevenueEntry` model and wires up auto-derivation.

**Migration:** The existing `property_finance_direct_bookings` table data is read-only going forward. New direct bookings create `reservations` records, which auto-create `revenue_entries`.

The finance summary API must combine:
1. `revenue_entries` (from Phase 1 reservations)
2. `property_finance_airbnb_rows` (legacy CSV imports for periods before Phase 2)
3. `property_finance_direct_bookings` (legacy direct bookings)

This hybrid approach ensures no data loss during migration.

---

## API Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/finance/:propertyId/summary | Monthly summary |
| GET | /api/finance/summary-all | All properties summary |
| GET | /api/finance/:propertyId/expenses | List expenses |
| POST | /api/finance/:propertyId/expenses | Add expense |
| PATCH | /api/finance/:propertyId/expenses/:id | Update expense |
| DELETE | /api/finance/:propertyId/expenses/:id | Delete expense |
| GET | /api/finance/:propertyId/loans | List loans |
| POST | /api/finance/:propertyId/loans | Add loan |
| GET | /api/finance/:propertyId/revenue | Revenue entries (auto-generated) |
| POST | /api/finance/:propertyId/import | Import Airbnb CSV (legacy) |
| GET | /api/finance/:propertyId/projections-config | Get projections config |
| PUT | /api/finance/:propertyId/projections-config | Save projections config |

All existing routes remain unchanged.
