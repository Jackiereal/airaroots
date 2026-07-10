import { requirePropertyAccess } from '@/src/shared/utils/route-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest, { params }: { params: Promise<{ propertyId: string }> }) {
  const { propertyId } = await params;
  // Activity/audit log was admin-only under the legacy role flag; preserved as 'admin' here.
  const { error: authError } = await requirePropertyAccess(propertyId, 'admin');
  if (authError) return authError;

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
