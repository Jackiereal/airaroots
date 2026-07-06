import { requireAdmin, requirePropertyAccess } from '@/lib/auth';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// Stores per-property projections config as JSONB in properties table
// Using a simple upsert into a projections_config column (added via migration below)
// Fallback: store as a JSON field in properties.description until migration applied

export async function GET(_req: NextRequest, { params }: { params: Promise<{ propertyId: string }> }) {
  const { propertyId } = await params;
  const { error: authError } = await requirePropertyAccess(propertyId);
  if (authError) return authError;

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
  const { error: authError } = await requireAdmin();
  if (authError) return authError;

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
