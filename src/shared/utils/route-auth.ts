import { NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '../../infrastructure/supabase/server';

export type AuthContext = {
  userId: string;
  organizationId: string;
};

/**
 * Validates auth and resolves organization_id for the calling user.
 * Returns { error } on failure or { ctx } on success.
 */
export async function requireOrgAuth(): Promise<
  | { error: NextResponse; ctx: null }
  | { error: null; ctx: AuthContext }
> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return {
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      ctx: null,
    };
  }

  const db = createServiceRoleClient();
  // Cast to unknown first because organization_id is added by migration 008
  // and the hand-written DB types stub doesn't include it yet.
  const { data: profileRaw } = await db
    .from('user_profiles')
    .select('organization_id')
    .eq('id', user.id)
    .maybeSingle();

  const profile = profileRaw as { organization_id?: string | null } | null;

  if (!profile?.organization_id) {
    return {
      error: NextResponse.json({ error: 'Organization not configured' }, { status: 403 }),
      ctx: null,
    };
  }

  return {
    error: null,
    ctx: {
      userId: user.id,
      organizationId: profile.organization_id,
    },
  };
}
