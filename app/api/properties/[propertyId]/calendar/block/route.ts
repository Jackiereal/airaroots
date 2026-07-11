import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { CalendarService } from '@/src/domains/calendar/services/calendar.service';
import { CreateManualBlockSchema } from '@/src/domains/calendar/schema';
import { requirePropertyWrite } from '@/src/shared/utils/route-auth';
import { handleApiError } from '@/src/shared/utils/api-error-handler';

type Params = { params: Promise<{ propertyId: string }> };

export async function POST(request: NextRequest, { params }: Params): Promise<NextResponse> {
  try {
    const { propertyId } = await params;
    const { error, ctx } = await requirePropertyWrite(propertyId);
    if (error) return error;

    const body = await request.json();
    const input = CreateManualBlockSchema.parse(body);

    const supabase = await createClient();
    const service = new CalendarService(supabase);
    const block = await service.createBlock(
      {
        organizationId: ctx!.organizationId,
        propertyId,
        startDate: input.startDate,
        endDate: input.endDate,
        blockType: input.blockType,
        reason: input.reason?.trim() || undefined,
        isPublic: input.isPublic,
      },
      ctx!.userId
    );

    return NextResponse.json({ block }, { status: 201 });
  } catch (error) {
    return handleApiError(error, `POST /api/properties/${(await params).propertyId}/calendar/block`);
  }
}
