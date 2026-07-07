import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { CalendarService } from '@/src/domains/calendar/services/calendar.service';
import { requireOrgAuth } from '@/src/shared/utils/route-auth';
import { handleApiError } from '@/src/shared/utils/api-error-handler';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { error, ctx } = await requireOrgAuth();
    if (error) return error;

    const url = new URL(request.url);
    const fromStr = url.searchParams.get('from');
    const toStr = url.searchParams.get('to');

    const from = fromStr ? new Date(fromStr) : (() => {
      const d = new Date();
      d.setDate(1);
      return d;
    })();
    const to = toStr ? new Date(toStr) : (() => {
      const d = new Date(from);
      d.setMonth(d.getMonth() + 1);
      return d;
    })();

    const supabase = await createClient();
    const service = new CalendarService(supabase);
    const blocks = await service.getBlocksForOrganization(ctx!.organizationId, from, to);

    return NextResponse.json({ blocks });
  } catch (error) {
    return handleApiError(error, 'GET /api/calendar');
  }
}
