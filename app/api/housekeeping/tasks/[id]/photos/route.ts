import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { HousekeepingService } from '@/src/domains/operations/services/housekeeping.service';
import { requireOrgAuth } from '@/src/shared/utils/route-auth';
import { handleApiError } from '@/src/shared/utils/api-error-handler';
import { z } from 'zod';

const AddPhotoSchema = z.object({
  url: z.string().url(),
  caption: z.string().max(200).optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { error } = await requireOrgAuth();
    if (error) return error;

    const { id } = await params;
    const supabase = await createClient();
    const service = new HousekeepingService(supabase);
    const photos = await service.getPhotos(id);

    return NextResponse.json({ photos });
  } catch (error) {
    return handleApiError(error, 'GET /api/housekeeping/tasks/[id]/photos');
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { error, ctx } = await requireOrgAuth();
    if (error) return error;

    const { id } = await params;
    const body = await request.json();
    const { url, caption } = AddPhotoSchema.parse(body);

    const supabase = await createClient();
    const service = new HousekeepingService(supabase);
    const photo = await service.addPhotoById(id, url, caption, ctx!.userId);

    return NextResponse.json({ photo }, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'POST /api/housekeeping/tasks/[id]/photos');
  }
}
