import { requireOrgRole, requireOrgWrite } from '@/src/shared/utils/route-auth';
import { createServiceRoleClient, createServiceRoleClientLoose } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// Stores per-property projections config as JSONB in properties table
// Using a simple upsert into a projections_config column (added via migration below)
// Fallback: store as a JSON field in properties.description until migration applied

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

  const db = createServiceRoleClient();
  const { data, error } = await db
    .from('properties')
    .select('projections_config')
    .eq('id', propertyId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ config: (data as Record<string, unknown>)?.projections_config ?? {} });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ propertyId: string }> }) {
  const { propertyId } = await params;
  const { error: authError, ctx } = await requireOrgWrite();
  if (authError) return authError;
  if (!(await assertPropertyInOrg(propertyId, ctx!.organizationId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const body = await req.json();
  const db = createServiceRoleClient();

  // Use loose client since projections_config may not be in generated types yet
  const { error } = await db
    .from('properties' as never)
    .update({ projections_config: body } as never)
    .eq('id', propertyId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
