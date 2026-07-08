import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClientLoose } from '@/src/infrastructure/supabase/server';
import { HousekeepingService } from '@/src/domains/operations/services/housekeeping.service';
import { handleApiError } from '@/src/shared/utils/api-error-handler';
import { z } from 'zod';

const PhotoSchema = z.object({
  url: z.string().url(),
  caption: z.string().max(200).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
): Promise<NextResponse> {
  try {
    const { token } = await params;
    const body = await request.json();
    const { url, caption } = PhotoSchema.parse(body);

    const supabase = createServiceRoleClientLoose();
    const service = new HousekeepingService(supabase);
    const photo = await service.addPhoto(token, url, caption);

    return NextResponse.json({ photo }, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'POST /api/hk/[token]/photos');
  }
}
