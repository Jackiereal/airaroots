import { requireOrgRole, requireOrgWrite } from '@/src/shared/utils/route-auth';
import { createServiceRoleClientLoose } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ propertyId: string }> }) {
  const { propertyId } = await params;
  const { error: authError, ctx } = await requireOrgRole('viewer');
  if (authError) return authError;

  const db = createServiceRoleClientLoose();
  const { data, error } = await db.from('properties').select('*').eq('id', propertyId).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data || data.organization_id !== ctx!.organizationId) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ property: data });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ propertyId: string }> }) {
  const { propertyId } = await params;
  const { error: authError, ctx } = await requireOrgWrite();
  if (authError) return authError;

  const db = createServiceRoleClientLoose();
  const { data: existing, error: fetchErr } = await db
    .from('properties')
    .select('organization_id')
    .eq('id', propertyId)
    .maybeSingle();
  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  if (!existing || existing.organization_id !== ctx!.organizationId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const body = (await req.json()) as Record<string, unknown>;
  const allowed = ['name', 'slug', 'address', 'description', 'platform'];
  const update: Record<string, unknown> = {};
  for (const k of allowed) {
    if (k in body) update[k] = body[k] ?? null;
  }

  const { data, error } = await db
    .from('properties')
    .update(update)
    .eq('id', propertyId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ property: data });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ propertyId: string }> }) {
  const { propertyId } = await params;
  const { error: authError, ctx } = await requireOrgWrite();
  if (authError) return authError;

  const db = createServiceRoleClientLoose();
  const { data: existing, error: fetchErr } = await db
    .from('properties')
    .select('organization_id')
    .eq('id', propertyId)
    .maybeSingle();
  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  if (!existing || existing.organization_id !== ctx!.organizationId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { error } = await db.from('properties').delete().eq('id', propertyId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
