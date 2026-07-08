import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { MaintenanceService } from '@/src/domains/operations/services/maintenance.service';
import { CreateMaintenanceRequestSchema } from '@/src/domains/operations/schema';
import { requireOrgAuth } from '@/src/shared/utils/route-auth';
import { handleApiError } from '@/src/shared/utils/api-error-handler';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { error, ctx } = await requireOrgAuth();
    if (error) return error;

    const url = new URL(request.url);
    const status = url.searchParams.get('status') ?? undefined;
    const priority = url.searchParams.get('priority') ?? undefined;
    const propertyId = url.searchParams.get('propertyId') ?? undefined;
    const openOnly = url.searchParams.get('openOnly') === 'true';

    const supabase = await createClient();
    const service = new MaintenanceService(supabase);

    const requests = await service.list(ctx!.organizationId, {
      status: status as Parameters<typeof service.list>[1] extends { status?: infer S } ? S : never,
      priority: priority as Parameters<typeof service.list>[1] extends { priority?: infer P } ? P : never,
      propertyId,
      openOnly,
    });

    return NextResponse.json({ requests });
  } catch (error) {
    return handleApiError(error, 'GET /api/maintenance');
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { error, ctx } = await requireOrgAuth();
    if (error) return error;

    const body = await request.json();
    const input = CreateMaintenanceRequestSchema.parse(body);

    const supabase = await createClient();
    const service = new MaintenanceService(supabase);
    const maintenanceRequest = await service.create(ctx!.organizationId, input, ctx!.userId);

    return NextResponse.json({ request: maintenanceRequest }, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'POST /api/maintenance');
  }
}
