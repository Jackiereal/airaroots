import { requireOrgAuth } from '@/src/shared/utils/route-auth';
import { createServiceRoleClientLoose } from '@/lib/supabase/server';
import { TemplateRepository } from '@/src/domains/communication/repositories/template.repository';
import { NextResponse } from 'next/server';
import { handleApiError } from '@/src/shared/utils/api-error-handler';

// GET — list the org's templates, seeding the 3 defaults on first access
// so the editor always has something to show.
export async function GET() {
  try {
    const { error: authError, ctx } = await requireOrgAuth();
    if (authError) return authError;

    const db = createServiceRoleClientLoose();
    const repo = new TemplateRepository(db);
    await repo.seedDefaults(ctx!.organizationId);
    const templates = await repo.findByOrg(ctx!.organizationId);

    return NextResponse.json({ templates });
  } catch (error) {
    return handleApiError(error, 'GET /api/communication/templates');
  }
}
