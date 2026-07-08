import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { HousekeepingService } from '@/src/domains/operations/services/housekeeping.service';
import { CreateHousekeepingTaskSchema } from '@/src/domains/operations/schema';
import { requireOrgAuth } from '@/src/shared/utils/route-auth';
import { handleApiError } from '@/src/shared/utils/api-error-handler';
import { ensureHandlers } from '@/src/infrastructure/events/ensure-handlers';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { error, ctx } = await requireOrgAuth();
    if (error) return error;

    const url = new URL(request.url);
    const date = url.searchParams.get('date') ?? undefined;
    const status = url.searchParams.get('status') ?? undefined;
    const propertyId = url.searchParams.get('propertyId') ?? undefined;

    const supabase = await createClient();
    const service = new HousekeepingService(supabase);

    const tasks = await service.listTasks(ctx!.organizationId, {
      date,
      status: status as Parameters<typeof service.listTasks>[1] extends { status?: infer S } ? S : never,
      propertyId,
    });

    return NextResponse.json({ tasks });
  } catch (error) {
    return handleApiError(error, 'GET /api/housekeeping/tasks');
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    await ensureHandlers();
    const { error, ctx } = await requireOrgAuth();
    if (error) return error;

    const body = await request.json();
    const input = CreateHousekeepingTaskSchema.parse(body);

    const supabase = await createClient();
    const service = new HousekeepingService(supabase);

    const task = await service.createTask({
      ...input,
      organizationId: ctx!.organizationId,
      createdBy: ctx!.userId,
    });

    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'POST /api/housekeeping/tasks');
  }
}
