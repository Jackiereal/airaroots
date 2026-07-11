import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClientLoose } from '@/src/infrastructure/supabase/server';
import { HousekeepingService } from '@/src/domains/operations/services/housekeeping.service';
import { InventoryService } from '@/src/domains/operations/services/inventory.service';
import { CompleteTaskSchema } from '@/src/domains/operations/schema';
import { handleApiError } from '@/src/shared/utils/api-error-handler';

// Public route — no auth. Token is the credential.

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
): Promise<NextResponse> {
  try {
    const { token } = await params;
    const supabase = createServiceRoleClientLoose();
    const service = new HousekeepingService(supabase);
    const task = await service.getTaskByToken(token);

    // Return task + inventory items for this property so housekeeper can log usage
    const inventoryService = new InventoryService(supabase);
    const inventory = await inventoryService.listByProperty(task.propertyId);

    return NextResponse.json({ task, inventory });
  } catch (error) {
    return handleApiError(error, 'GET /api/hk/[token]');
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
): Promise<NextResponse> {
  try {
    const { token } = await params;
    const body = await request.json();
    const input = CompleteTaskSchema.parse(body);

    const supabase = createServiceRoleClientLoose();
    const service = new HousekeepingService(supabase);

    const task = await service.completeTask(token, input.checklist, input.notes);

    // Log inventory usage if provided
    if (input.inventoryUsed && input.inventoryUsed.length > 0) {
      const inventoryService = new InventoryService(supabase);
      await inventoryService.logTaskUsage(task.propertyId, task.id, input.inventoryUsed);
    }

    return NextResponse.json({ task });
  } catch (error) {
    return handleApiError(error, 'POST /api/hk/[token]');
  }
}
