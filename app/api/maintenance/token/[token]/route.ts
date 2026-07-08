import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClientLoose } from '@/src/infrastructure/supabase/server';
import { MaintenanceService } from '@/src/domains/operations/services/maintenance.service';
import { ResolveMaintenanceSchema } from '@/src/domains/operations/schema';
import { handleApiError } from '@/src/shared/utils/api-error-handler';
import { z } from 'zod';

// Public route — no auth. Token is the credential.

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
): Promise<NextResponse> {
  try {
    const { token } = await params;
    const supabase = createServiceRoleClientLoose();
    const service = new MaintenanceService(supabase);
    const maintenanceRequest = await service.getByToken(token);

    return NextResponse.json({ request: maintenanceRequest });
  } catch (error) {
    return handleApiError(error, 'GET /api/maintenance/token/[token]');
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
): Promise<NextResponse> {
  try {
    const { token } = await params;
    const body = await request.json();
    const { notes } = ResolveMaintenanceSchema.parse(body);

    const supabase = createServiceRoleClientLoose();
    const service = new MaintenanceService(supabase);
    const maintenanceRequest = await service.resolveByToken(token);

    void notes; // notes field available for future use (e.g. store in description)

    return NextResponse.json({ request: maintenanceRequest });
  } catch (error) {
    return handleApiError(error, 'POST /api/maintenance/token/[token]');
  }
}

const PhotoSchema = z.object({
  url: z.string().url(),
  caption: z.string().max(200).optional(),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
): Promise<NextResponse> {
  try {
    const { token } = await params;
    const body = await request.json();
    const { url, caption } = PhotoSchema.parse(body);

    const supabase = createServiceRoleClientLoose();
    const service = new MaintenanceService(supabase);
    const photo = await service.addPhoto(token, url, caption);

    return NextResponse.json({ photo }, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'PUT /api/maintenance/token/[token]');
  }
}
