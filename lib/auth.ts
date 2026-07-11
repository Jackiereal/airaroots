import { createClient, createServiceRoleClient } from './supabase/server';
import { NextResponse } from 'next/server';

export async function getUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function getUserProfile() {
  const user = await getUser();
  if (!user) return null;
  const serviceClient = createServiceRoleClient();
  const { data } = await serviceClient
    .from('user_profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();
  return data ? { ...data, email: user.email } : null;
}

/** True if this user holds any property_access grant (any role, any property). */
export async function hasAnyPropertyAccess(userId: string): Promise<boolean> {
  const serviceClient = createServiceRoleClient();
  const { data } = await serviceClient
    .from('property_access')
    .select('id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();
  return !!data;
}

export async function requireAdmin() {
  const profile = await getUserProfile();
  if (!profile) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }), profile: null };
  }
  if (!(await hasAnyPropertyAccess(profile.id))) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }), profile: null };
  }
  return { error: null, profile };
}

export async function requireAuth() {
  const user = await getUser();
  if (!user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), user: null };
  }
  return { error: null, user };
}

/** Check client can access this property (or is admin) */
export async function requirePropertyAccess(propertyId: string) {
  const profile = await getUserProfile();
  if (!profile) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), profile: null };
  }
  if (profile.role === 'admin') {
    return { error: null, profile };
  }
  const serviceClient = createServiceRoleClient();
  const { data } = await serviceClient
    .from('property_access')
    .select('id')
    .eq('property_id', propertyId)
    .eq('user_id', profile.id)
    .maybeSingle();
  if (!data) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }), profile: null };
  }
  return { error: null, profile };
}
