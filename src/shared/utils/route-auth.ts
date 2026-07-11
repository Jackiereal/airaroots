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

// ─────────────────────────────────────────────
// ROLE-AWARE GUARDS
// requireOrgAuth above only checks "does this user belong to an org" —
// every member, including a viewer, passes. These wrap it with a check
// against organization_members.role (owner > admin > manager > viewer)
// for routes that need to distinguish read-only members from ones who
// can write.
// ─────────────────────────────────────────────

export const ORG_ROLE_RANK = { viewer: 0, manager: 1, admin: 2, owner: 3 } as const;

export type OrgRole = keyof typeof ORG_ROLE_RANK;

export type RoleAuthContext = AuthContext & { role: OrgRole };

/**
 * requireOrgAuth + a minimum organization_members.role check.
 * Returns the same ctx shape plus `role`, so existing call sites that
 * only destructure { error, ctx } keep working if you swap this in.
 */
export async function requireOrgRole(minRole: OrgRole): Promise<
  | { error: NextResponse; ctx: null }
  | { error: null; ctx: RoleAuthContext }
> {
  const { error, ctx } = await requireOrgAuth();
  if (error) return { error, ctx: null };

  const db = createServiceRoleClient();
  const { data } = await db
    .from('organization_members')
    .select('role')
    .eq('organization_id', ctx.organizationId)
    .eq('user_id', ctx.userId)
    .maybeSingle();

  const role = (data as { role?: OrgRole } | null)?.role;

  if (!role || ORG_ROLE_RANK[role] < ORG_ROLE_RANK[minRole]) {
    return {
      error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
      ctx: null,
    };
  }

  return { error: null, ctx: { ...ctx, role } };
}

/** Shorthand: manager and above (excludes viewer). */
export async function requireOrgWrite() {
  return requireOrgRole('manager');
}

// ─────────────────────────────────────────────
// PROPERTY-LEVEL GUARDS
// requireOrgRole only checks org membership — an org member with no
// property_access grant still passes it. property_finance_*, properties,
// and every operational table (housekeeping/maintenance/vendors/inventory/
// reservations/calendar/channels) are gated per-property via property_access
// (see migration 015), not by org role. API routes use the service-role
// client, which bypasses RLS entirely, so this check must happen here in
// the app layer — RLS alone does not protect these routes.
// ─────────────────────────────────────────────

export type PropertyAccessRole = 'admin' | 'client';

const PROPERTY_ROLE_RANK = { client: 0, admin: 1 } as const;

export type PropertyAuthContext = AuthContext & { propertyRole: PropertyAccessRole };

/**
 * requireOrgAuth + a property_access grant check for the given property.
 * minRole 'client' (default) means any grant (read); 'admin' means the
 * grant must be role='admin' (write). No grant = 403, regardless of org role.
 */
export async function requirePropertyAccess(
  propertyId: string,
  minRole: PropertyAccessRole = 'client'
): Promise<
  | { error: NextResponse; ctx: null }
  | { error: null; ctx: PropertyAuthContext }
> {
  const { error, ctx } = await requireOrgAuth();
  if (error) return { error, ctx: null };

  const db = createServiceRoleClient();
  const { data } = await db
    .from('property_access')
    .select('role')
    .eq('property_id', propertyId)
    .eq('user_id', ctx.userId)
    .maybeSingle();

  const role = (data as { role?: PropertyAccessRole } | null)?.role;

  if (!role || PROPERTY_ROLE_RANK[role] < PROPERTY_ROLE_RANK[minRole]) {
    return {
      error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
      ctx: null,
    };
  }

  return { error: null, ctx: { ...ctx, propertyRole: role } };
}

/** Shorthand: property must belong to caller's org AND caller must have an admin grant on it. */
export async function requirePropertyWrite(propertyId: string) {
  return requirePropertyAccess(propertyId, 'admin');
}
