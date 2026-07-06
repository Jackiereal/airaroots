import { createServiceRoleClientLoose } from '@/lib/supabase/server';

export async function writeAuditLog(args: {
  userId: string;
  propertyId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  beforeState?: Record<string, unknown> | null;
  afterState?: Record<string, unknown> | null;
}): Promise<void> {
  try {
    const client = createServiceRoleClientLoose();
    await client.from('audit_log').insert({
      user_id: args.userId,
      property_id: args.propertyId ?? null,
      action: args.action,
      resource_type: args.resourceType,
      resource_id: args.resourceId ?? null,
      before_state: args.beforeState ?? null,
      after_state: args.afterState ?? null,
    });
  } catch {
    // Non-fatal: audit failures never block main operations
  }
}
