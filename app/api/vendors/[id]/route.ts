import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { VendorService } from '@/src/domains/operations/services/vendor.service';
import { UpdateVendorSchema } from '@/src/domains/operations/schema';
import { requireOrgAuth } from '@/src/shared/utils/route-auth';
import { handleApiError } from '@/src/shared/utils/api-error-handler';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { error, ctx } = await requireOrgAuth();
    if (error) return error;

    const { id } = await params;
    const supabase = await createClient();
    const service = new VendorService(supabase);
    const vendor = await service.get(id, ctx!.organizationId);

    return NextResponse.json({ vendor });
  } catch (error) {
    return handleApiError(error, 'GET /api/vendors/[id]');
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { error, ctx } = await requireOrgAuth();
    if (error) return error;

    const { id } = await params;
    const body = await request.json();
    const input = UpdateVendorSchema.parse(body);

    const supabase = await createClient();
    const service = new VendorService(supabase);
    const vendor = await service.update(ctx!.organizationId, id, input);

    return NextResponse.json({ vendor });
  } catch (error) {
    return handleApiError(error, 'PATCH /api/vendors/[id]');
  }
}
