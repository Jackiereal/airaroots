import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ReservationService } from '@/src/domains/reservation/services/reservation.service';
import { UpdateReservationSchema } from '@/src/domains/reservation/schema';
import { requireOrgAuth } from '@/src/shared/utils/route-auth';
import { handleApiError } from '@/src/shared/utils/api-error-handler';
import { NotFoundError } from '@/src/shared/errors/domain-errors';
import { ensureHandlers } from '@/src/infrastructure/events/ensure-handlers';

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

    return NextResponse.json({ reservation });
  } catch (error) {
    return handleApiError(error, `GET /api/reservations/${(await params).id}`);
  }
}

export async function PATCH(request: NextRequest, { params }: Params): Promise<NextResponse> {
  try {
    await ensureHandlers();
    const { error, ctx } = await requireOrgAuth();
    if (error) return error;

    const { id } = await params;
    const supabase = await createClient();
    const service = new ReservationService(supabase);

    const existing = await service.findById(id);
    if (!existing || existing.organizationId !== ctx!.organizationId) {
      throw new NotFoundError('Reservation', id);
    }

    const body = await request.json();
    const input = UpdateReservationSchema.parse(body);
    const reservation = await service.update(id, input, ctx!.userId);

    return NextResponse.json({ reservation });
  } catch (error) {
    return handleApiError(error, `PATCH /api/reservations/${(await params).id}`);
  }
}
