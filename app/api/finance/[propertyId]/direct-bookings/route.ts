import { writeAuditLog } from '@/lib/admin/audit';
import { requireAdmin, requirePropertyAccess } from '@/lib/auth';
import { directBookingAuditSnapshot } from '@/lib/property-finance/audit-snapshots';
import { toPeriodMonth } from '@/lib/property-finance/parse-airbnb-csv';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest, { params }: { params: Promise<{ propertyId: string }> }) {
  const { propertyId } = await params;
  const { error: authError } = await requirePropertyAccess(propertyId);
  if (authError) return authError;

  const url = new URL(req.url);
  const month = url.searchParams.get('month');
  const db = createServiceRoleClient();
  let query = db
    .from('property_finance_direct_bookings')
    .select('*')
    .eq('property_id', propertyId)
    .order('created_at', { ascending: false });

  if (month && /^\d{4}-\d{2}$/.test(month)) {
    let periodMonth: string;
    try { periodMonth = toPeriodMonth(month); }
    catch { return NextResponse.json({ error: 'Invalid month' }, { status: 400 }); }
    query = query.eq('period_month', periodMonth);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ directBookings: data ?? [] });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ propertyId: string }> }) {
  const { propertyId } = await params;
  const { error: authError, profile } = await requireAdmin();
  if (authError) return authError;

  const body = (await req.json()) as {
    month?: string;
    guest_name?: string;
    amount?: number;
    guest_count?: number | null;
    guest_phone?: string | null;
    received_date?: string | null;
    check_in?: string | null;
    check_out?: string | null;
    nights?: number | null;
    notes?: string | null;
  };

  if (!body.month || !/^\d{4}-\d{2}$/.test(body.month)) return NextResponse.json({ error: 'month (YYYY-MM) required' }, { status: 400 });
  if (!body.guest_name?.trim()) return NextResponse.json({ error: 'guest_name required' }, { status: 400 });
  if (body.amount == null || Number(body.amount) < 0) return NextResponse.json({ error: 'amount must be non-negative' }, { status: 400 });

  let periodMonth: string;
  try { periodMonth = toPeriodMonth(body.month); }
  catch { return NextResponse.json({ error: 'Invalid month' }, { status: 400 }); }

  const db = createServiceRoleClient();
  const { data, error } = await db
    .from('property_finance_direct_bookings')
    .insert({
      property_id: propertyId,
      period_month: periodMonth,
      guest_name: body.guest_name.trim(),
      amount: Number(body.amount),
      guest_count: body.guest_count ?? null,
      guest_phone: body.guest_phone?.trim() || null,
      received_date: body.received_date || null,
      check_in: body.check_in || null,
      check_out: body.check_out || null,
      nights: body.nights ?? null,
      notes: body.notes?.trim() || null,
      created_by: profile!.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  void writeAuditLog({
    userId: profile!.id, propertyId, action: 'create',
    resourceType: 'property_finance_direct_booking', resourceId: data.id,
    afterState: directBookingAuditSnapshot(data as unknown as Record<string, unknown>),
  });
  return NextResponse.json({ directBooking: data });
}
