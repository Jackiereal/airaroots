import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ReservationService } from '@/src/domains/reservation/services/reservation.service';
import { GuestService } from '@/src/domains/guest/services/guest.service';
import { requireOrgAuth } from '@/src/shared/utils/route-auth';
import { handleApiError } from '@/src/shared/utils/api-error-handler';
import { NotFoundError } from '@/src/shared/errors/domain-errors';

type Params = { params: Promise<{ id: string }> };

// POST /api/reservations/[id]/guest — findOrCreate guest from reservation data and link it
export async function POST(_request: NextRequest, { params }: Params): Promise<NextResponse> {
  try {
    const { error, ctx } = await requireOrgAuth();
    if (error) return error;

    const { id } = await params;
    const supabase = await createClient();
    const reservationService = new ReservationService(supabase);

    const reservation = await reservationService.findById(id);
    if (!reservation || reservation.organizationId !== ctx!.organizationId) {
      throw new NotFoundError('Reservation', id);
    }

    const guestId = await reservationService.linkGuest(id, ctx!.organizationId);

    const guestService = new GuestService(supabase);
    const guest = await guestService.findByIdWithStays(guestId);

    return NextResponse.json({ guest });
  } catch (error) {
    return handleApiError(error, `POST /api/reservations/${(await params).id}/guest`);
  }
}
