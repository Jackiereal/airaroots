import { requireOrgAuth } from '@/src/shared/utils/route-auth';
import { createServiceRoleClientLoose } from '@/lib/supabase/server';
import { AutomationRuleRepository } from '@/src/domains/automation/repositories/automation-rule.repository';
import { NextResponse } from 'next/server';
import { handleApiError } from '@/src/shared/utils/api-error-handler';

// GET — list the org's automation rules, seeding the default (inactive) system
// rules on first access so the settings page always has something to show.
export async function GET() {
  try {
    const { error: authError, ctx } = await requireOrgAuth();
    if (authError) return authError;

    const db = createServiceRoleClientLoose();
    const repo = new AutomationRuleRepository(db);
    await repo.seedDefaults(ctx!.organizationId);
    const rules = await repo.findByOrg(ctx!.organizationId);

    return NextResponse.json({ rules });
  } catch (error) {
    return handleApiError(error, 'GET /api/automation/rules');
  }
}
