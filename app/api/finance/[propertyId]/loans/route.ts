import { requireAdmin, requirePropertyAccess } from '@/lib/auth';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ propertyId: string }> }) {
  const { propertyId } = await params;
  const { error: authError } = await requirePropertyAccess(propertyId);
  if (authError) return authError;

  const db = createServiceRoleClient();
  const { data, error } = await db
    .from('property_finance_loans')
    .select('*')
    .eq('property_id', propertyId)
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ loans: data ?? [] });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ propertyId: string }> }) {
  const { propertyId } = await params;
  const { error: authError, profile } = await requireAdmin();
  if (authError) return authError;

  const body = (await req.json()) as {
    name?: string;
    principal?: number;
    annual_rate?: number;
    tenure_months?: number;
    start_date?: string | null;
    status?: string;
  };

  if (!body.name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 });
  if (!body.principal || body.principal <= 0) return NextResponse.json({ error: 'principal must be positive' }, { status: 400 });

  const db = createServiceRoleClient();
  const { data, error } = await db
    .from('property_finance_loans')
    .insert({
      property_id: propertyId,
      name: body.name.trim(),
      principal: Number(body.principal),
      annual_rate: body.annual_rate != null ? Number(body.annual_rate) : null,
      tenure_months: body.tenure_months != null ? Number(body.tenure_months) : null,
      start_date: body.start_date || null,
      status: body.status === 'closed' ? 'closed' : 'active',
      created_by: profile!.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ loan: data });
}
