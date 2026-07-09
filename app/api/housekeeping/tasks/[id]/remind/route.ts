import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { HousekeepingService } from '@/src/domains/operations/services/housekeeping.service';
import { requireOrgAuth } from '@/src/shared/utils/route-auth';
import { handleApiError } from '@/src/shared/utils/api-error-handler';

// Marks the reminder as sent. Called after the manager opens the WhatsApp
// link client-side — there is no server-side send to confirm against.
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { error } = await requireOrgAuth();
    if (error) return error;

    const { id } = await params;
    const supabase = await createClient();
    const service = new HousekeepingService(supabase);
    await service.markReminderSent(id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error, 'POST /api/housekeeping/tasks/[id]/remind');
  }
}
