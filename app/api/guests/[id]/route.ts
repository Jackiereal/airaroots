import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { GuestService } from '@/src/domains/guest/services/guest.service';
import { requireOrgAuth } from '@/src/shared/utils/route-auth';
import { handleApiError } from '@/src/shared/utils/api-error-handler';
import { NotFoundError } from '@/src/shared/errors/domain-errors';
import { z } from 'zod';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params): Promise<NextResponse> {
  try {
    const { error, ctx } = await requireOrgAuth();
    if (error) return error;

    const { id } = await params;
    const supabase = await createClient();
    const service = new GuestService(supabase);

    const guest = await service.findByIdWithStays(id);
    if (!guest || guest.organizationId !== ctx!.organizationId) {
      throw new NotFoundError('Guest', id);
    }

    return NextResponse.json({ guest });
  } catch (error) {
    return handleApiError(error, `GET /api/guests/${(await params).id}`);
  }
}

const UpdateGuestSchema = z.object({
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export async function PATCH(request: NextRequest, { params }: Params): Promise<NextResponse> {
  try {
    const { error, ctx } = await requireOrgAuth();
    if (error) return error;

    const { id } = await params;
    const supabase = await createClient();
    const service = new GuestService(supabase);

    const existing = await service.findById(id);
    if (!existing || existing.organizationId !== ctx!.organizationId) {
      throw new NotFoundError('Guest', id);
    }

    const body = await request.json();
    const input = UpdateGuestSchema.parse(body);
    const guest = await service.update(id, input);

    return NextResponse.json({ guest });
  } catch (error) {
    return handleApiError(error, `PATCH /api/guests/${(await params).id}`);
  }
}
