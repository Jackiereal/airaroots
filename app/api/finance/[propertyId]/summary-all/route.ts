import { requirePropertyAccess } from '@/src/shared/utils/route-auth';
import { summarizeImportedAirbnbRows } from '@/lib/property-finance/aggregate';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ propertyId: string }> }) {
  const { propertyId } = await params;
  const { error: authError } = await requirePropertyAccess(propertyId);
  if (authError) return authError;

  const db = createServiceRoleClient();
  const [expRes, dirRes, airRes] = await Promise.all([
    db.from('property_finance_expenses').select('amount, expense_type').eq('property_id', propertyId),
    db.from('property_finance_direct_bookings').select('amount').eq('property_id', propertyId),
    db.from('property_finance_airbnb_rows').select('row_type, amount, paid_out, service_fee, gross_earnings').eq('property_id', propertyId),
  ]);

  if (expRes.error) return NextResponse.json({ error: expRes.error.message }, { status: 500 });
  if (dirRes.error) return NextResponse.json({ error: dirRes.error.message }, { status: 500 });
  if (airRes.error) return NextResponse.json({ error: airRes.error.message }, { status: 500 });

  const expenseTotal = (expRes.data ?? []).reduce((s, r) => s + Number(r.amount), 0);
  const directTotal = (dirRes.data ?? []).reduce((s, r) => s + Number(r.amount), 0);
  const airbnb = summarizeImportedAirbnbRows(airRes.data ?? []);
  const cashInbound = airbnb.bankPayouts + airbnb.taxWithholding + directTotal;
  const netCash = cashInbound - expenseTotal;

  const byCategory: Record<string, number> = {};
  for (const e of expRes.data ?? []) {
    const k = e.expense_type?.trim() || 'Other';
    byCategory[k] = (byCategory[k] ?? 0) + Number(e.amount);
  }

  return NextResponse.json({
    expenseTotal: Math.round(expenseTotal * 100) / 100,
    directTotal: Math.round(directTotal * 100) / 100,
    cashInbound: Math.round(cashInbound * 100) / 100,
    netCash: Math.round(netCash * 100) / 100,
    airbnbBank: Math.round(airbnb.bankPayouts * 100) / 100,
    taxWithholding: Math.round(airbnb.taxWithholding * 100) / 100,
    reservationCount: airbnb.reservationCount,
    byCategory: Object.fromEntries(Object.entries(byCategory).map(([k, v]) => [k, Math.round(v * 100) / 100])),
  });
}
