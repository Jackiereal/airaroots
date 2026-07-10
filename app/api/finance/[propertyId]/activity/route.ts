import { requireOrgRole } from '@/src/shared/utils/route-auth';
import { createServiceRoleClient, createServiceRoleClientLoose } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest, { params }: { params: Promise<{ propertyId: string }> }) {
  const { propertyId } = await params;
  // Activity/audit log was admin-only under the legacy role flag; preserved as 'admin' here.
  const { error: authError, ctx } = await requireOrgRole('admin');
  if (authError) return authError;

  const propDb = createServiceRoleClientLoose();
  const { data: property } = await propDb.from('properties').select('organization_id').eq('id', propertyId).maybeSingle();
  if (!property || property.organization_id !== ctx!.organizationId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const url = new URL(req.url);
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get('limit') || '100')));

  const db = createServiceRoleClient();
  const { data, error } = await db
    .from('audit_log')
    .select('*')
    .eq('property_id', propertyId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ activity: data ?? [] });
}
