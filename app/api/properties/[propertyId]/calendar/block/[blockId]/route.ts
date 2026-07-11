import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { CalendarService } from '@/src/domains/calendar/services/calendar.service';
import { UpdateBlockSchema } from '@/src/domains/calendar/schema';
import { requirePropertyWrite } from '@/src/shared/utils/route-auth';
import { handleApiError } from '@/src/shared/utils/api-error-handler';

type Params = { params: Promise<{ propertyId: string; blockId: string }> };

export async function PATCH(request: NextRequest, { params }: Params): Promise<NextResponse> {
  try {
    const { propertyId, blockId } = await params;
    const { error } = await requirePropertyWrite(propertyId);
    if (error) return error;

    const body = await request.json();
    const input = UpdateBlockSchema.parse(body);

    const supabase = await createClient();
    const service = new CalendarService(supabase);
    const block = await service.updateBlock(propertyId, blockId, input);

    return NextResponse.json({ block });
  } catch (error) {
    return handleApiError(error, `PATCH /api/properties/.../calendar/block/${(await params).blockId}`);
  }
}

export async function DELETE(_request: NextRequest, { params }: Params): Promise<NextResponse> {
  try {
    const { propertyId, blockId } = await params;
    const { error, ctx } = await requirePropertyWrite(propertyId);
    if (error) return error;

    const supabase = await createClient();
    const service = new CalendarService(supabase);
    await service.deleteBlock(propertyId, blockId, ctx!.userId);

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, `DELETE /api/properties/.../calendar/block/${(await params).blockId}`);
  }
}
