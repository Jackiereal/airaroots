import { writeAuditLog } from '@/lib/admin/audit';
import { requireAdmin } from '@/lib/auth';
import { parseAirbnbCsv, toPeriodMonth } from '@/lib/property-finance/parse-airbnb-csv';
import { createServiceRoleClient } from '@/lib/supabase/server';
import type { Json } from '@/types/database.types';
import { NextRequest, NextResponse } from 'next/server';

const CHUNK = 200;

export async function POST(req: NextRequest, { params }: { params: Promise<{ propertyId: string }> }) {
  const { propertyId } = await params;
  const { error: authError, profile } = await requireAdmin();
  if (authError) return authError;

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const month = formData.get('month') as string | null;

  if (!file) return NextResponse.json({ error: 'file required' }, { status: 400 });
  if (!month || !/^\d{4}-\d{2}$/.test(month)) return NextResponse.json({ error: 'month=YYYY-MM required' }, { status: 400 });

  let periodMonth: string;
  try { periodMonth = toPeriodMonth(month); }
  catch { return NextResponse.json({ error: 'Invalid month' }, { status: 400 }); }

  const text = await file.text();
  const { rows, headersOk } = parseAirbnbCsv(text);

  if (rows.length === 0) {
    return NextResponse.json({ error: 'No rows parsed from CSV' }, { status: 400 });
  }

  const db = createServiceRoleClient();

  // Delete existing rows for this property + month before import
  await db
    .from('property_finance_airbnb_rows')
    .delete()
    .eq('property_id', propertyId)
    .eq('period_month', periodMonth);

  const insertRows = rows.map(r => ({
    property_id: propertyId,
    period_month: periodMonth,
    row_date: r.row_date || null,
    arriving_by_date: r.arriving_by_date || null,
    row_type: r.row_type || null,
    confirmation_code: r.confirmation_code || null,
    booking_date: r.booking_date || null,
    start_date: r.start_date || null,
    end_date: r.end_date || null,
    nights: r.nights ?? null,
    guest: r.guest || null,
    listing: r.listing || null,
    details: r.details || null,
    reference_code: r.reference_code || null,
    currency: r.currency || null,
    amount: r.amount ?? null,
    paid_out: r.paid_out ?? null,
    service_fee: r.service_fee ?? null,
    fast_pay_fee: r.fast_pay_fee ?? null,
    cleaning_fee: r.cleaning_fee ?? null,
    gross_earnings: r.gross_earnings ?? null,
    airbnb_remitted_tax: r.airbnb_remitted_tax ?? null,
    earnings_year: r.earnings_year || null,
    raw: r.raw as unknown as Json,
    created_by: profile!.id,
  }));

  let inserted = 0;
  for (let i = 0; i < insertRows.length; i += CHUNK) {
    const chunk = insertRows.slice(i, i + CHUNK);
    const { error } = await db.from('property_finance_airbnb_rows').insert(chunk);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    inserted += chunk.length;
  }

  void writeAuditLog({
    userId: profile!.id, propertyId, action: 'import',
    resourceType: 'property_finance_import',
    afterState: { period_month: periodMonth, rows_imported: inserted, headers_ok: headersOk },
  });

  return NextResponse.json({ imported: inserted, headersOk, periodMonth });
}
