import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { HousekeepingService } from '@/src/domains/operations/services/housekeeping.service';
import { CreateHousekeepingStaffSchema } from '@/src/domains/operations/schema';
import { requireOrgAuth } from '@/src/shared/utils/route-auth';
import { handleApiError } from '@/src/shared/utils/api-error-handler';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { error, ctx } = await requireOrgAuth();
    if (error) return error;

    const url = new URL(request.url);
    const activeOnly = url.searchParams.get('activeOnly') !== 'false';

    const supabase = await createClient();
    const service = new HousekeepingService(supabase);
    const staff = await service.listStaff(ctx!.organizationId, activeOnly);

    return NextResponse.json({ staff });
  } catch (error) {
    return handleApiError(error, 'GET /api/housekeeping/staff');
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { error, ctx } = await requireOrgAuth();
    if (error) return error;

    const body = await request.json();
    const input = CreateHousekeepingStaffSchema.parse(body);

    const supabase = await createClient();
    const service = new HousekeepingService(supabase);
    const member = await service.createStaff(ctx!.organizationId, input);

    return NextResponse.json({ staff: member }, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'POST /api/housekeeping/staff');
  }
}
