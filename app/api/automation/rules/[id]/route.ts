import { requireOrgRole } from '@/src/shared/utils/route-auth';
import { createServiceRoleClientLoose } from '@/lib/supabase/server';
import { AutomationRuleRepository } from '@/src/domains/automation/repositories/automation-rule.repository';
import { UpdateRuleSchema } from '@/src/domains/automation/schema';
import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/src/shared/utils/api-error-handler';
import { NotFoundError } from '@/src/shared/errors/domain-errors';

type Params = { params: Promise<{ id: string }> };

// PATCH — toggle a rule on/off or rename it. Manager+ only.
export async function PATCH(req: NextRequest, { params }: Params): Promise<NextResponse> {
  try {
    const { error: authError, ctx } = await requireOrgRole('manager');
    if (authError) return authError;

    const { id } = await params;
    const input = UpdateRuleSchema.parse(await req.json());

    const db = createServiceRoleClientLoose();
    const repo = new AutomationRuleRepository(db);
    const updated = await repo.update(ctx!.organizationId, id, input);
    if (!updated) throw new NotFoundError('AutomationRule', id);

    return NextResponse.json({ rule: updated });
  } catch (error) {
    return handleApiError(error, 'PATCH /api/automation/rules/[id]');
  }
}

// DELETE — remove a custom rule. System (seeded) rules are protected; deleting
// one returns 400 (toggle it off instead).
export async function DELETE(_req: NextRequest, { params }: Params): Promise<NextResponse> {
  try {
    const { error: authError, ctx } = await requireOrgRole('manager');
    if (authError) return authError;

    const { id } = await params;
    const db = createServiceRoleClientLoose();
    const repo = new AutomationRuleRepository(db);
    const deleted = await repo.deleteCustom(ctx!.organizationId, id);
    if (!deleted) {
      return NextResponse.json(
        { error: 'Rule not found or is a protected system rule (toggle it off instead)' },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error, 'DELETE /api/automation/rules/[id]');
  }
}
