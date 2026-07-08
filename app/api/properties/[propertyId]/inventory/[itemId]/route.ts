import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { InventoryService } from '@/src/domains/operations/services/inventory.service';
import { UpdateInventoryItemSchema, LogTransactionSchema } from '@/src/domains/operations/schema';
import { requireOrgAuth } from '@/src/shared/utils/route-auth';
import { handleApiError } from '@/src/shared/utils/api-error-handler';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
): Promise<NextResponse> {
  try {
    const { error } = await requireOrgAuth();
    if (error) return error;

    const { itemId } = await params;
    const body = await request.json();
    const input = UpdateInventoryItemSchema.parse(body);

    const supabase = await createClient();
    const service = new InventoryService(supabase);
    const item = await service.update(itemId, input);

    return NextResponse.json({ item });
  } catch (error) {
    return handleApiError(error, 'PATCH /api/properties/[propertyId]/inventory/[itemId]');
  }
}

// POST /transactions sub-resource
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
): Promise<NextResponse> {
  try {
    const { error, ctx } = await requireOrgAuth();
    if (error) return error;

    const { itemId } = await params;
    const body = await request.json();
    const input = LogTransactionSchema.parse(body);

    const supabase = await createClient();
    const service = new InventoryService(supabase);
    const result = await service.logTransaction({
      itemId,
      type: input.type,
      quantity: input.quantity,
      cost: input.cost,
      notes: input.notes,
      createdBy: ctx!.userId,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'POST /api/properties/[propertyId]/inventory/[itemId]');
  }
}
