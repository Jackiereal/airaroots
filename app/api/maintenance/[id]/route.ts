import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { MaintenanceService } from '@/src/domains/operations/services/maintenance.service';
import { UpdateMaintenanceRequestSchema } from '@/src/domains/operations/schema';
import { requireOrgAuth } from '@/src/shared/utils/route-auth';
import { handleApiError } from '@/src/shared/utils/api-error-handler';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { error } = await requireOrgAuth();
    if (error) return error;

    const { id } = await params;
    const supabase = await createClient();
    const service = new MaintenanceService(supabase);
    const maintenanceRequest = await service.get(id);

    return NextResponse.json({ request: maintenanceRequest });
  } catch (error) {
    return handleApiError(error, 'GET /api/maintenance/[id]');
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { error } = await requireOrgAuth();
    if (error) return error;

    const { id } = await params;
    const supabase = await createClient();
    const service = new MaintenanceService(supabase);
    await service.delete(id);

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleApiError(error, 'DELETE /api/maintenance/[id]');
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { error } = await requireOrgAuth();
    if (error) return error;

    const { id } = await params;
    const body = await request.json();
    const input = UpdateMaintenanceRequestSchema.parse(body);

    const supabase = await createClient();
    const service = new MaintenanceService(supabase);
    const maintenanceRequest = await service.update(id, input);

    return NextResponse.json({ request: maintenanceRequest });
  } catch (error) {
    return handleApiError(error, 'PATCH /api/maintenance/[id]');
  }
}
