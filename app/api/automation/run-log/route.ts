import { requireOrgAuth } from '@/src/shared/utils/route-auth';
import { createServiceRoleClientLoose } from '@/lib/supabase/server';
import { AutomationRuleRepository } from '@/src/domains/automation/repositories/automation-rule.repository';
import { NextResponse } from 'next/server';
import { handleApiError } from '@/src/shared/utils/api-error-handler';

// GET — recent automation run log for the org (observability). Read-only.
export async function GET() {
  try {
    const { error: authError, ctx } = await requireOrgAuth();
    if (authError) return authError;

    const db = createServiceRoleClientLoose();
    const repo = new AutomationRuleRepository(db);
    const entries = await repo.findLogByOrg(ctx!.organizationId);

    return NextResponse.json({ entries });
  } catch (error) {
    return handleApiError(error, 'GET /api/automation/run-log');
  }
}
