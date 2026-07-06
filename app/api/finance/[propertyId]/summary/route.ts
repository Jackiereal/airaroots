import { summarizeImportedAirbnbRows } from '@/lib/property-finance/aggregate';
import { totalBookedNightsAirbnbReservations, totalBookedNightsDirect } from '@/lib/property-finance/booked-nights';
import {
  effectiveGuestCountForAirbnbReservation,
  guestCountFromAirbnbRaw,
  sumAirbnbReservationGuests,
  sumDirectGuestCounts,
} from '@/lib/property-finance/guest-totals';
import { lastNMonthStartsUtc } from '@/lib/property-finance/months';
import { toPeriodMonth } from '@/lib/property-finance/parse-airbnb-csv';
import { sumOutOfPocketByOwner } from '@/lib/property-finance/expense-paid-source';
import { requirePropertyAccess } from '@/lib/auth';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

function ym(pm: string): string { return pm.slice(0, 7); }

const INSIGHTS_EXCLUDED_EXPENSE_TYPE = 'EMI / Loan';

function buildInsights(args: {
  expenseTotal: number;
  grossBookingSum: number;
  bankPayouts: number;
  directTotal: number;
  taxWithholding: number;
  topExpenseCategory: string | null;
  topExpenseShare: number;
}): string[] {
  const out: string[] = [];
  const { expenseTotal, grossBookingSum, bankPayouts, directTotal, taxWithholding, topExpenseCategory, topExpenseShare } = args;
  if (grossBookingSum > 0 && expenseTotal / grossBookingSum > 0.35) {
    out.push('Operating expenses above 35% of gross booking value — revisit recurring costs.');
  }
  const platformCash = bankPayouts + taxWithholding;
  if (platformCash > 0 && directTotal > 0 && directTotal / (directTotal + platformCash) < 0.08) {
    out.push('Direct bookings are a small share — promoting direct stays can reduce platform fees.');
  }
  if (topExpenseCategory && topExpenseShare > 0.25) {
    out.push(`${topExpenseCategory} is a large share of monthly spend (${Math.round(topExpenseShare * 100)}%) — worth benchmarking.`);
  }
  if (taxWithholding < 0 && expenseTotal > 0 && Math.abs(taxWithholding) > expenseTotal * 0.15) {
    out.push('Tax withholding this month is material — confirm deductions align with filings.');
  }
  return out.slice(0, 6);
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ propertyId: string }> }) {
  const { propertyId } = await params;
  const { error: authError } = await requirePropertyAccess(propertyId);
  if (authError) return authError;

  const { searchParams } = new URL(req.url);
  const month = searchParams.get('month');
  const trendMonths = Math.min(24, Math.max(1, Number(searchParams.get('trendMonths') || '6')));

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: 'month=YYYY-MM required' }, { status: 400 });
  }

  let periodMonth: string;
  try { periodMonth = toPeriodMonth(month); }
  catch { return NextResponse.json({ error: 'Invalid month' }, { status: 400 }); }

  const db = createServiceRoleClient();

  const [expRes, dirRes, airRes, oopRes] = await Promise.all([
    db.from('property_finance_expenses').select('*').eq('property_id', propertyId).eq('period_month', periodMonth),
    db.from('property_finance_direct_bookings').select('*').eq('property_id', propertyId).eq('period_month', periodMonth),
    db.from('property_finance_airbnb_rows').select('*').eq('property_id', propertyId).eq('period_month', periodMonth),
    db.from('property_finance_expenses').select('paid_from, owner_id, amount').eq('property_id', propertyId).eq('paid_from', 'out_of_pocket'),
  ]);

  if (expRes.error) return NextResponse.json({ error: expRes.error.message }, { status: 500 });
  if (dirRes.error) return NextResponse.json({ error: dirRes.error.message }, { status: 500 });
  if (airRes.error) return NextResponse.json({ error: airRes.error.message }, { status: 500 });
  if (oopRes.error) return NextResponse.json({ error: oopRes.error.message }, { status: 500 });

  const expenses = expRes.data ?? [];
  const direct = dirRes.data ?? [];
  const airbnbRows = airRes.data ?? [];

  const expenseTotal = expenses.reduce((s, r) => s + Number(r.amount), 0);
  const directTotal = direct.reduce((s, r) => s + Number(r.amount), 0);
  const expensesForInsights = expenses.filter(e => e.expense_type.trim() !== INSIGHTS_EXCLUDED_EXPENSE_TYPE);
  const expenseTotalForInsights = expensesForInsights.reduce((s, r) => s + Number(r.amount), 0);

  const byCategoryFull: Record<string, number> = {};
  for (const e of expenses) {
    const k = e.expense_type.trim() || 'Other';
    byCategoryFull[k] = (byCategoryFull[k] ?? 0) + Number(e.amount);
  }
  const byCategoryInsights: Record<string, number> = {};
  for (const e of expensesForInsights) {
    const k = e.expense_type.trim() || 'Other';
    byCategoryInsights[k] = (byCategoryInsights[k] ?? 0) + Number(e.amount);
  }

  let topExpenseCategory: string | null = null;
  let topExpenseAmount = 0;
  for (const [k, v] of Object.entries(byCategoryInsights)) {
    if (v > topExpenseAmount) { topExpenseAmount = v; topExpenseCategory = k; }
  }
  const topExpenseShare = expenseTotalForInsights > 0 && topExpenseCategory ? topExpenseAmount / expenseTotalForInsights : 0;

  const airbnb = summarizeImportedAirbnbRows(airbnbRows);
  const daysBookedDirect = totalBookedNightsDirect(direct);
  const daysBookedAirbnb = totalBookedNightsAirbnbReservations(airbnbRows);
  const daysBooked = daysBookedDirect + daysBookedAirbnb;
  const cashInboundEstimate = airbnb.bankPayouts + airbnb.taxWithholding + directTotal;
  const netCash = cashInboundEstimate - expenseTotal;
  const totalBookingCount = airbnb.reservationCount + direct.length;

  const reservationRowsMonth = airbnbRows.filter(r => r.row_type === 'Reservation');
  const guestsMonthAirbnb = sumAirbnbReservationGuests(reservationRowsMonth.map(r => ({ raw: r.raw, guest_count: r.guest_count })));
  const guestsMonthDirect = sumDirectGuestCounts(direct);
  const guestsMonthTotal = guestsMonthAirbnb + guestsMonthDirect;

  const [allDirectRes, allAirbnbRes] = await Promise.all([
    db.from('property_finance_direct_bookings').select('guest_count').eq('property_id', propertyId),
    db.from('property_finance_airbnb_rows').select('raw, guest_count').eq('property_id', propertyId).eq('row_type', 'Reservation'),
  ]);

  const guestsAllTimeDirect = sumDirectGuestCounts(allDirectRes.data ?? []);
  const guestsAllTimeAirbnb = sumAirbnbReservationGuests(allAirbnbRes.data ?? []);

  const insights = buildInsights({
    expenseTotal: expenseTotalForInsights, grossBookingSum: airbnb.grossBookingSum,
    bankPayouts: airbnb.bankPayouts, directTotal, taxWithholding: airbnb.taxWithholding,
    topExpenseCategory, topExpenseShare,
  });

  const monthStarts = lastNMonthStartsUtc(trendMonths);
  const [expTrendRes, dirTrendRes, airTrendRes] = await Promise.all([
    db.from('property_finance_expenses').select('period_month, amount').eq('property_id', propertyId).in('period_month', monthStarts),
    db.from('property_finance_direct_bookings').select('period_month, amount').eq('property_id', propertyId).in('period_month', monthStarts),
    db.from('property_finance_airbnb_rows').select('period_month, row_type, amount, paid_out, service_fee, gross_earnings').eq('property_id', propertyId).in('period_month', monthStarts),
  ]);

  const expByPm: Record<string, number> = {};
  for (const r of expTrendRes.data ?? []) expByPm[r.period_month as string] = (expByPm[r.period_month as string] ?? 0) + Number(r.amount);
  const dirByPm: Record<string, number> = {};
  for (const r of dirTrendRes.data ?? []) dirByPm[r.period_month as string] = (dirByPm[r.period_month as string] ?? 0) + Number(r.amount);
  const airByPm: Record<string, typeof airTrendRes.data> = {};
  for (const r of airTrendRes.data ?? []) {
    const pm = r.period_month as string;
    if (!airByPm[pm]) airByPm[pm] = [];
    airByPm[pm]!.push(r);
  }

  const trend = monthStarts.map(pm => {
    const a = summarizeImportedAirbnbRows(airByPm[pm] ?? []);
    const ex = expByPm[pm] ?? 0;
    const di = dirByPm[pm] ?? 0;
    const net = a.bankPayouts + a.taxWithholding + di - ex;
    return { month: ym(pm), netCash: Math.round(net * 100) / 100, expenses: Math.round(ex * 100) / 100, airbnbBank: Math.round(a.bankPayouts * 100) / 100, direct: Math.round(di * 100) / 100 };
  });

  const reservationPreview = airbnbRows
    .filter(r => r.row_type === 'Reservation')
    .sort((a, b) => (b.start_date ?? '').localeCompare(a.start_date ?? ''))
    .slice(0, 40)
    .map(r => ({
      id: r.id, guest: r.guest, start_date: r.start_date, end_date: r.end_date, nights: r.nights,
      gross_earnings: r.gross_earnings, amount: r.amount, paid_out: r.paid_out, service_fee: r.service_fee,
      guest_count: r.guest_count ?? null,
      guests_inferred: guestCountFromAirbnbRaw(r.raw),
      guests_effective: effectiveGuestCountForAirbnbReservation({ raw: r.raw, guest_count: r.guest_count }),
    }));

  return NextResponse.json({
    month, periodMonth,
    outOfPocketByOwner: sumOutOfPocketByOwner(oopRes.data ?? []),
    expenses: expenses.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)),
    directBookings: direct.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)),
    airbnbRowCount: airbnbRows.length,
    reservationPreview,
    aggregates: {
      ...airbnb, daysBooked, daysBookedDirect, daysBookedAirbnb,
      directBookingCount: direct.length,
      expenseTotal: Math.round(expenseTotal * 100) / 100,
      directTotal: Math.round(directTotal * 100) / 100,
      cashInboundEstimate: Math.round(cashInboundEstimate * 100) / 100,
      netCash: Math.round(netCash * 100) / 100,
      expenseByCategory: Object.fromEntries(Object.entries(byCategoryFull).map(([k, v]) => [k, Math.round(v * 100) / 100])),
      totalBookingCount,
      averageCostPerBooking: totalBookingCount > 0 ? Math.round(expenseTotal / totalBookingCount * 100) / 100 : null,
      averageGuestChargePerNight: daysBooked > 0 ? Math.round((airbnb.grossBookingSum + directTotal) / daysBooked * 100) / 100 : null,
      guestsMonthTotal, guestsMonthAirbnb, guestsMonthDirect,
      guestsAllTimeTotal: guestsAllTimeDirect + guestsAllTimeAirbnb,
      guestsAllTimeAirbnb, guestsAllTimeDirect,
    },
    insights, trend,
  });
}
