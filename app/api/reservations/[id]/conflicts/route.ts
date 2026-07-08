import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ReservationService } from '@/src/domains/reservation/services/reservation.service';
import { requireOrgAuth } from '@/src/shared/utils/route-auth';
import { handleApiError } from '@/src/shared/utils/api-error-handler';
import { NotFoundError } from '@/src/shared/errors/domain-errors';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params): Promise<NextResponse> {
  try {
    const { error, ctx } = await requireOrgAuth();
    if (error) return error;

    const { id } = await params;
    const supabase = await createClient();
    const service = new ReservationService(supabase);

    const reservation = await service.findById(id);
    if (!reservation || reservation.organizationId !== ctx!.organizationId) {
      throw new NotFoundError('Reservation', id);
    }

    const conflicting = await service.findConflicting(id);

    return NextResponse.json({ conflicts: conflicting });
  } catch (error) {
    return handleApiError(error, `GET /api/reservations/${(await params).id}/conflicts`);
  }
}
