import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ReservationService } from '@/src/domains/reservation/services/reservation.service';
import { CreateReservationSchema } from '@/src/domains/reservation/schema';
import { requireOrgAuth } from '@/src/shared/utils/route-auth';
import { handleApiError } from '@/src/shared/utils/api-error-handler';
import { ensureHandlers } from '@/src/infrastructure/events/ensure-handlers';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { error, ctx } = await requireOrgAuth();
    if (error) return error;

    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50'), 200);
    const offset = parseInt(url.searchParams.get('offset') ?? '0');
    const status = url.searchParams.get('status') ?? undefined;

    const supabase = await createClient();
    const service = new ReservationService(supabase);

    const reservations = await service.findByOrganization(ctx!.organizationId, {
      limit,
      offset,
      status: status as Parameters<typeof service.findByOrganization>[1] extends { status?: infer S } ? S : never,
    });

    return NextResponse.json({ reservations });
  } catch (error) {
    return handleApiError(error, 'GET /api/reservations');
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    await ensureHandlers();
    const { error, ctx } = await requireOrgAuth();
    if (error) return error;

    const body = await request.json();
    const input = CreateReservationSchema.parse({ ...body, organizationId: ctx!.organizationId });

    const supabase = await createClient();
    const service = new ReservationService(supabase);
    const reservation = await service.create(input, ctx!.userId);

    return NextResponse.json({ reservation }, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'POST /api/reservations');
  }
}
