import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { InventoryService } from '@/src/domains/operations/services/inventory.service';
import { CreateInventoryItemSchema } from '@/src/domains/operations/schema';
import { requireOrgAuth } from '@/src/shared/utils/route-auth';
import { handleApiError } from '@/src/shared/utils/api-error-handler';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ propertyId: string }> }
): Promise<NextResponse> {
  try {
    const { error } = await requireOrgAuth();
    if (error) return error;

    const { propertyId } = await params;
    const url = new URL(request.url);
    const category = url.searchParams.get('category') ?? undefined;

    const supabase = await createClient();
    const service = new InventoryService(supabase);
    const items = await service.listByProperty(
      propertyId,
      category as Parameters<typeof service.listByProperty>[1]
    );

    return NextResponse.json({ items });
  } catch (error) {
    return handleApiError(error, 'GET /api/properties/[propertyId]/inventory');
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ propertyId: string }> }
): Promise<NextResponse> {
  try {
    const { error, ctx } = await requireOrgAuth();
    if (error) return error;

    const { propertyId } = await params;
    const body = await request.json();
    const input = CreateInventoryItemSchema.parse({ ...body, propertyId });

    const supabase = await createClient();
    const service = new InventoryService(supabase);
    const item = await service.create(ctx!.organizationId, input);

    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'POST /api/properties/[propertyId]/inventory');
  }
}
