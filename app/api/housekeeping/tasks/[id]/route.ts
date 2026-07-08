import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { HousekeepingService } from '@/src/domains/operations/services/housekeeping.service';
import { UpdateHousekeepingTaskSchema } from '@/src/domains/operations/schema';
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
    const service = new HousekeepingService(supabase);
    const task = await service.getTask(id);

    return NextResponse.json({ task });
  } catch (error) {
    return handleApiError(error, 'GET /api/housekeeping/tasks/[id]');
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
    const input = UpdateHousekeepingTaskSchema.parse(body);

    const supabase = await createClient();
    const service = new HousekeepingService(supabase);
    const task = await service.updateTask(id, input);

    return NextResponse.json({ task });
  } catch (error) {
    return handleApiError(error, 'PATCH /api/housekeeping/tasks/[id]');
  }
}
