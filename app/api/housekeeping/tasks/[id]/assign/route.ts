import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { HousekeepingService } from '@/src/domains/operations/services/housekeeping.service';
import { requireOrgAuth } from '@/src/shared/utils/route-auth';
import { handleApiError } from '@/src/shared/utils/api-error-handler';
import { z } from 'zod';

const AssignSchema = z.object({
  staffId: z.string().uuid(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { error } = await requireOrgAuth();
    if (error) return error;

    const { id } = await params;
    const body = await request.json();
    const { staffId } = AssignSchema.parse(body);

    const supabase = await createClient();
    const service = new HousekeepingService(supabase);
    const task = await service.assignTask(id, staffId);

    return NextResponse.json({ task });
  } catch (error) {
    return handleApiError(error, 'POST /api/housekeeping/tasks/[id]/assign');
  }
}
