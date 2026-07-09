import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { VendorService } from '@/src/domains/operations/services/vendor.service';
import { CreateVendorSchema } from '@/src/domains/operations/schema';
import { requireOrgAuth } from '@/src/shared/utils/route-auth';
import { handleApiError } from '@/src/shared/utils/api-error-handler';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { error, ctx } = await requireOrgAuth();
    if (error) return error;

    const url = new URL(request.url);
    const activeOnly = url.searchParams.get('activeOnly') !== 'false';
    const category = url.searchParams.get('category') ?? undefined;
    const propertyId = url.searchParams.get('propertyId') ?? undefined;

    const supabase = await createClient();
    const service = new VendorService(supabase);
    const vendors = await service.list(ctx!.organizationId, {
      activeOnly,
      category: category as Parameters<typeof service.list>[1] extends { category?: infer C } ? C : never,
      propertyId,
    });

    return NextResponse.json({ vendors });
  } catch (error) {
    return handleApiError(error, 'GET /api/vendors');
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { error, ctx } = await requireOrgAuth();
    if (error) return error;

    const body = await request.json();
    const input = CreateVendorSchema.parse(body);

    const supabase = await createClient();
    const service = new VendorService(supabase);
    const vendor = await service.create(ctx!.organizationId, input);

    return NextResponse.json({ vendor }, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'POST /api/vendors');
  }
}
