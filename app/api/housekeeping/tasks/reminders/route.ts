import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { HousekeepingService } from '@/src/domains/operations/services/housekeeping.service';
import { requireOrgAuth } from '@/src/shared/utils/route-auth';
import { handleApiError } from '@/src/shared/utils/api-error-handler';

// Tasks scheduled for `date` (default today), assigned to staff with a phone
// number, not yet reminded. Manager clicks each to open the WhatsApp link —
// there is no server-side auto-send without WhatsApp Business API access.
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { error, ctx } = await requireOrgAuth();
    if (error) return error;

    const url = new URL(request.url);
    const date = url.searchParams.get('date') ?? new Date().toISOString().split('T')[0];

    const supabase = await createClient();
    const service = new HousekeepingService(supabase);
    const tasks = await service.getTasksNeedingReminder(ctx!.organizationId, date);

    return NextResponse.json({ tasks });
  } catch (error) {
    return handleApiError(error, 'GET /api/housekeeping/tasks/reminders');
  }
}
