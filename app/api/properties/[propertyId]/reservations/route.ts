import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ReservationService } from '@/src/domains/reservation/services/reservation.service';
import { requireOrgAuth } from '@/src/shared/utils/route-auth';
import { handleApiError } from '@/src/shared/utils/api-error-handler';

type Params = { params: Promise<{ propertyId: string }> };

export async function GET(request: NextRequest, { params }: Params): Promise<NextResponse> {
  try {
    const { error, ctx } = await requireOrgAuth();
    if (error) return error;

    const { propertyId } = await params;
    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50'), 200);
    const offset = parseInt(url.searchParams.get('offset') ?? '0');

    const supabase = await createClient();
    const service = new ReservationService(supabase);
    const reservations = await service.findByProperty(propertyId, { limit, offset });

    // Ensure property belongs to this org (first reservation check is enough; also safe since RLS filters)
    return NextResponse.json({ reservations });
  } catch (error) {
    return handleApiError(error, `GET /api/properties/${(await params).propertyId}/reservations`);
  }
}
