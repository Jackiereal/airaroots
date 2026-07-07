import { writeAuditLog } from '@/lib/admin/audit';
import { requireAdmin } from '@/lib/auth';
import { parseAirbnbCsv, toPeriodMonth } from '@/lib/property-finance/parse-airbnb-csv';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { createServiceRoleClientLoose } from '@/src/infrastructure/supabase/server';
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

  // Upsert Reservation rows into the reservations table
  const reservationRows = rows.filter(
    r => r.row_type === 'Reservation' && r.confirmation_code && r.start_date && r.end_date,
  );

  let reservationsUpserted = 0;
  if (reservationRows.length > 0) {
    const looseDb = createServiceRoleClientLoose();

    const { data: property } = await looseDb
      .from('properties')
      .select('organization_id')
      .eq('id', propertyId)
      .single();
    const organizationId = property?.organization_id as string | null;

    if (organizationId) {
      const codes = reservationRows.map(r => r.confirmation_code!);
      const { data: existing } = await looseDb
        .from('reservations')
        .select('id, platform_booking_id')
        .eq('organization_id', organizationId)
        .in('platform_booking_id', codes)
        .is('deleted_at', null);

      const existingMap = new Map(
        (existing ?? []).map((r: { id: string; platform_booking_id: string }) => [
          r.platform_booking_id,
          r.id,
        ]),
      );

      for (const r of reservationRows) {
        const nights = r.nights ?? 1;
        const cleaningFee = r.cleaning_fee ?? 0;
        const grossEarnings = r.gross_earnings ?? 0;
        const nightlyRate = nights > 0 ? Math.round((grossEarnings - cleaningFee) / nights) : 0;
        const platformCommission = r.service_fee != null ? Math.abs(r.service_fee) : 0;
        const taxes = r.airbnb_remitted_tax ?? 0;

        const existingId = existingMap.get(r.confirmation_code!);
        if (existingId) {
          await looseDb
            .from('reservations')
            .update({
              check_in: r.start_date,
              check_out: r.end_date,
              nightly_rate: nightlyRate,
              cleaning_fee: cleaningFee,
              platform_commission: platformCommission,
              taxes,
              guest_name: r.guest ?? null,
            })
            .eq('id', existingId);
        } else {
          await looseDb.from('reservations').insert({
            organization_id: organizationId,
            property_id: propertyId,
            channel: 'airbnb',
            platform_booking_id: r.confirmation_code,
            check_in: r.start_date,
            check_out: r.end_date,
            adults: 1,
            children: 0,
            pets: 0,
            nightly_rate: nightlyRate,
            cleaning_fee: cleaningFee,
            taxes,
            other_fees: 0,
            platform_commission: platformCommission,
            guest_name: r.guest ?? null,
            status: 'confirmed',
          });
        }
        reservationsUpserted++;
      }
    }
  }

  void writeAuditLog({
    userId: profile!.id, propertyId, action: 'import',
    resourceType: 'property_finance_import',
    afterState: { period_month: periodMonth, rows_imported: inserted, headers_ok: headersOk, reservations_upserted: reservationsUpserted },
  });

  return NextResponse.json({ imported: inserted, headersOk, periodMonth, reservationsUpserted });
}
