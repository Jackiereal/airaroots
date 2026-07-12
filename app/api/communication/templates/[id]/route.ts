import { requireOrgRole } from '@/src/shared/utils/route-auth';
import { createServiceRoleClientLoose } from '@/lib/supabase/server';
import { TemplateRepository } from '@/src/domains/communication/repositories/template.repository';
import { UpdateTemplateSchema } from '@/src/domains/communication/schema';
import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/src/shared/utils/api-error-handler';
import { NotFoundError } from '@/src/shared/errors/domain-errors';

type Params = { params: Promise<{ id: string }> };

// PATCH — edit a template's body/subject/active flag. Manager+ only.
export async function PATCH(req: NextRequest, { params }: Params): Promise<NextResponse> {
  try {
    const { error: authError, ctx } = await requireOrgRole('manager');
    if (authError) return authError;

    const { id } = await params;
    const input = UpdateTemplateSchema.parse(await req.json());

    const db = createServiceRoleClientLoose();
    const repo = new TemplateRepository(db);
    const updated = await repo.update(ctx!.organizationId, id, input);
    if (!updated) throw new NotFoundError('CommunicationTemplate', id);

    return NextResponse.json({ template: updated });
  } catch (error) {
    return handleApiError(error, 'PATCH /api/communication/templates/[id]');
  }
}
