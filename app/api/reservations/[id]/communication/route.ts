import { requireOrgAuth } from '@/src/shared/utils/route-auth';
import { createServiceRoleClientLoose } from '@/lib/supabase/server';
import { CommunicationLogRepository } from '@/src/domains/communication/repositories/communication-log.repository';
import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/src/shared/utils/api-error-handler';
import { NotFoundError } from '@/src/shared/errors/domain-errors';

type Params = { params: Promise<{ id: string }> };

// GET — the communication log for one reservation (read-only Messages list).
export async function GET(_req: NextRequest, { params }: Params): Promise<NextResponse> {
  try {
    const { error: authError, ctx } = await requireOrgAuth();
    if (authError) return authError;

    const { id } = await params;
    const db = createServiceRoleClientLoose();

    // Scope check: the reservation must belong to the caller's org.
    const { data: reservation } = await db
      .from('reservations')
      .select('organization_id')
      .eq('id', id)
      .maybeSingle();
    if (!reservation || (reservation as { organization_id: string }).organization_id !== ctx!.organizationId) {
      throw new NotFoundError('Reservation', id);
    }

    const repo = new CommunicationLogRepository(db);
    const log = await repo.findByReservation(id);
    return NextResponse.json({ log });
  } catch (error) {
    return handleApiError(error, 'GET /api/reservations/[id]/communication');
  }
}
