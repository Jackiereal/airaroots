import { requireOrgRole } from '@/src/shared/utils/route-auth';
import { createServiceRoleClient, createServiceRoleClientLoose } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

async function assertPropertyInOrg(propertyId: string, organizationId: string): Promise<boolean> {
  const db = createServiceRoleClientLoose();
  const { data } = await db.from('properties').select('organization_id').eq('id', propertyId).maybeSingle();
  return !!data && data.organization_id === organizationId;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ propertyId: string }> }) {
  const { propertyId } = await params;
  const { error: authError, ctx } = await requireOrgRole('admin');
  if (authError) return authError;
  if (!(await assertPropertyInOrg(propertyId, ctx!.organizationId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const url = new URL(req.url);
  const ownerId = url.searchParams.get('owner_id');

  const db = createServiceRoleClient();
  let query = db
    .from('property_finance_expenses')
    .select('*')
    .eq('property_id', propertyId)
    .eq('paid_from', 'out_of_pocket')
    .order('created_at', { ascending: false });

  if (ownerId) query = query.eq('owner_id', ownerId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ expenses: data ?? [] });
}
