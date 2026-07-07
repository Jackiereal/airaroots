import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { CalendarService } from '@/src/domains/calendar/services/calendar.service';
import { CreateSeasonalRateSchema } from '@/src/domains/calendar/schema';
import { requireOrgAuth } from '@/src/shared/utils/route-auth';
import { handleApiError } from '@/src/shared/utils/api-error-handler';

type Params = { params: Promise<{ propertyId: string }> };

export async function GET(_request: NextRequest, { params }: Params): Promise<NextResponse> {
  try {
    const { error } = await requireOrgAuth();
    if (error) return error;

    const { propertyId } = await params;
    const supabase = await createClient();
    const service = new CalendarService(supabase);
    const rates = await service.getSeasonalRates(propertyId);

    return NextResponse.json({ rates });
  } catch (error) {
    return handleApiError(error, `GET /api/properties/${(await params).propertyId}/seasonal-rates`);
  }
}

export async function POST(request: NextRequest, { params }: Params): Promise<NextResponse> {
  try {
    const { error, ctx } = await requireOrgAuth();
    if (error) return error;

    const { propertyId } = await params;
    const body = await request.json();
    const input = CreateSeasonalRateSchema.parse(body);

    const supabase = await createClient();
    const service = new CalendarService(supabase);
    const rate = await service.createSeasonalRate({
      organizationId: ctx!.organizationId,
      propertyId,
      ...input,
    });

    return NextResponse.json({ rate }, { status: 201 });
  } catch (error) {
    return handleApiError(error, `POST /api/properties/${(await params).propertyId}/seasonal-rates`);
  }
}
