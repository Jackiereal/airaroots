import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ReservationService } from '@/src/domains/reservation/services/reservation.service';
import { requireOrgAuth } from '@/src/shared/utils/route-auth';
import { handleApiError } from '@/src/shared/utils/api-error-handler';
import { NotFoundError } from '@/src/shared/errors/domain-errors';
import { z } from 'zod';

const ResolveSchema = z.object({
  action: z.enum(['cancel_this', 'cancel_conflicting', 'mark_resolved']),
  conflictingId: z.string().uuid().optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params): Promise<NextResponse> {
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

    const body = await request.json();
    const { action, conflictingId } = ResolveSchema.parse(body);

    const updated = await service.resolveConflict(id, action, ctx!.userId, conflictingId);

    return NextResponse.json({ reservation: updated });
  } catch (error) {
    return handleApiError(error, `POST /api/reservations/${(await params).id}/resolve`);
  }
}
