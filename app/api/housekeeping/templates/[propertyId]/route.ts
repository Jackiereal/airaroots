import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClientLoose } from '@/src/infrastructure/supabase/server';
import { HousekeepingService } from '@/src/domains/operations/services/housekeeping.service';
import { ChecklistItemSchema } from '@/src/domains/operations/schema';
import { requireOrgAuth, requirePropertyAccess, requirePropertyWrite } from '@/src/shared/utils/route-auth';
import { handleApiError } from '@/src/shared/utils/api-error-handler';
import { z } from 'zod';

const UpsertTemplateSchema = z.object({
  items: z.array(ChecklistItemSchema).min(1),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ propertyId: string }> }
): Promise<NextResponse> {
  try {
    const { propertyId } = await params;
    const { error } = await requirePropertyAccess(propertyId);
    if (error) return error;

    const supabase = createServiceRoleClientLoose();
    const service = new HousekeepingService(supabase);
    const items = await service.getTemplate(propertyId);

    return NextResponse.json({ items });
  } catch (error) {
    return handleApiError(error, 'GET /api/housekeeping/templates/[propertyId]');
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ propertyId: string }> }
): Promise<NextResponse> {
  try {
    const { error, ctx } = await requireOrgAuth();
    if (error) return error;

    const { propertyId } = await params;
    const body = await request.json();
    const { items } = UpsertTemplateSchema.parse(body);

    const supabase = await createClient();
    const service = new HousekeepingService(supabase);
    await service.upsertTemplate(propertyId, ctx!.organizationId, items);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error, 'PUT /api/housekeeping/templates/[propertyId]');
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ propertyId: string }> }
): Promise<NextResponse> {
  try {
    const { propertyId } = await params;
    const { error } = await requirePropertyWrite(propertyId);
    if (error) return error;

    const supabase = await createClient();
    const service = new HousekeepingService(supabase);
    await service.resetTemplate(propertyId);

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleApiError(error, 'DELETE /api/housekeeping/templates/[propertyId]');
  }
}
