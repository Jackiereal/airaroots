import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { AvailabilityService } from '@/src/domains/calendar/services/availability.service';
import { requireOrgAuth } from '@/src/shared/utils/route-auth';
import { handleApiError } from '@/src/shared/utils/api-error-handler';

type Params = { params: Promise<{ propertyId: string }> };

export async function GET(request: NextRequest, { params }: Params): Promise<NextResponse> {
  try {
    const { error } = await requireOrgAuth();
    if (error) return error;

    const { propertyId } = await params;
    const url = new URL(request.url);
    const checkIn = url.searchParams.get('checkIn');
    const checkOut = url.searchParams.get('checkOut');

    if (!checkIn || !checkOut) {
      return NextResponse.json(
        { error: 'checkIn and checkOut query params required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const service = new AvailabilityService(supabase);
    const result = await service.checkAvailability(
      propertyId,
      new Date(checkIn),
      new Date(checkOut)
    );

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error, `GET /api/properties/${(await params).propertyId}/availability`);
  }
}
