import { requirePropertyWrite } from '@/src/shared/utils/route-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ propertyId: string; id: string }> }) {
  const { propertyId, id } = await params;
  const { error: authError } = await requirePropertyWrite(propertyId);
  if (authError) return authError;

  const { guest_count } = (await req.json()) as { guest_count?: number | null };
  const db = createServiceRoleClient();
  const { data: existing } = await db
    .from('property_finance_airbnb_rows')
    .select('id').eq('id', id).eq('property_id', propertyId).maybeSingle();
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const gc = guest_count != null && Number.isFinite(Number(guest_count)) && Number(guest_count) >= 1
    ? Math.min(Math.floor(Number(guest_count)), 99)
    : null;

  const { data, error } = await db
    .from('property_finance_airbnb_rows')
    .update({ guest_count: gc }).eq('id', id).eq('property_id', propertyId).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ row: data });
}
