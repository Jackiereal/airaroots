import { requireOrgRole } from '@/src/shared/utils/route-auth';
import { createServiceRoleClient, createServiceRoleClientLoose } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

async function assertPropertyInOrg(propertyId: string, organizationId: string): Promise<boolean> {
  const db = createServiceRoleClientLoose();
  const { data } = await db.from('properties').select('organization_id').eq('id', propertyId).maybeSingle();
  return !!data && data.organization_id === organizationId;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ propertyId: string }> }) {
  const { propertyId } = await params;
  const { error: authError, ctx } = await requireOrgRole('viewer');
  if (authError) return authError;
  if (!(await assertPropertyInOrg(propertyId, ctx!.organizationId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const db = createServiceRoleClient();
  const { data, error } = await db
    .from('property_finance_direct_bookings')
    .select('*')
    .eq('property_id', propertyId)
    .gte('check_in', today)
    .order('check_in', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ upcoming: data ?? [] });
}
