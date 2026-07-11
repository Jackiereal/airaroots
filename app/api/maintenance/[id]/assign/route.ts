import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { MaintenanceService } from '@/src/domains/operations/services/maintenance.service';
import { requireOrgAuth } from '@/src/shared/utils/route-auth';
import { handleApiError } from '@/src/shared/utils/api-error-handler';
import { z } from 'zod';

const AssignSchema = z.object({
  assignedTo: z.string().uuid().nullable().optional(),
  vendorId: z.string().uuid().nullable().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { error, ctx } = await requireOrgAuth();
    if (error) return error;

    const { id } = await params;
    const body = await request.json();
    const input = AssignSchema.parse(body);

    const supabase = await createClient();
    const service = new MaintenanceService(supabase);
    const maintenanceRequest = await service.assign(ctx!.organizationId, id, {
      assignedTo: input.assignedTo ?? undefined,
      vendorId: input.vendorId ?? undefined,
    });

    return NextResponse.json({ request: maintenanceRequest });
  } catch (error) {
    return handleApiError(error, 'POST /api/maintenance/[id]/assign');
  }
}
