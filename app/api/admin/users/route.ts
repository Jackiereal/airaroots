import { requireAdmin } from '@/lib/auth';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(_req: NextRequest) {
  const { error: authError } = await requireAdmin();
  if (authError) return authError;

  const db = createServiceRoleClient();
  const { data: profiles, error } = await db
    .from('user_profiles')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ users: profiles ?? [] });
}

export async function PATCH(req: NextRequest) {
  const { error: authError } = await requireAdmin();
  if (authError) return authError;

  const { userId, role } = (await req.json()) as { userId?: string; role?: string };
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });
  if (role !== 'admin' && role !== 'client') return NextResponse.json({ error: 'role must be admin or client' }, { status: 400 });

  const db = createServiceRoleClient();
  const { error } = await db.from('user_profiles').update({ role }).eq('id', userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
