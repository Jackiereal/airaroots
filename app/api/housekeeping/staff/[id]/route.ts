import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { HousekeepingService } from '@/src/domains/operations/services/housekeeping.service';
import { UpdateHousekeepingStaffSchema } from '@/src/domains/operations/schema';
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
    const member = await service.getStaff(id);

    return NextResponse.json({ staff: member });
  } catch (error) {
    return handleApiError(error, 'GET /api/housekeeping/staff/[id]');
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
    const input = UpdateHousekeepingStaffSchema.parse(body);

    const supabase = await createClient();
    const service = new HousekeepingService(supabase);
    const member = await service.updateStaff(id, input);

    return NextResponse.json({ staff: member });
  } catch (error) {
    return handleApiError(error, 'PATCH /api/housekeeping/staff/[id]');
  }
}
