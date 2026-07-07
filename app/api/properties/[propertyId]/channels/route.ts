import { NextResponse } from 'next/server';
import { requireOrgAuth } from '@/src/shared/utils/route-auth';
import { handleApiError } from '@/src/shared/utils/api-error-handler';
import { channelConnectionService } from '@/src/domains/channel/services/channel-connection.service';
import { z } from 'zod';

const CreateChannelConnectionSchema = z.object({
  channel: z.enum(['airbnb', 'booking_com', 'direct', 'vrbo', 'expedia', 'other']),
  icalUrl: z.string().url().optional(),
});

type Params = { params: Promise<{ propertyId: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const { error, ctx } = await requireOrgAuth();
    if (error) return error;
    const { propertyId } = await params;
    const connections = await channelConnectionService.findByProperty(propertyId);
    const filtered = connections.filter(c => c.organizationId === ctx.organizationId);
    return NextResponse.json(filtered);
  } catch (err) {
    return handleApiError(err, "channel");
  }
}

export async function POST(req: Request, { params }: Params) {
  try {
    const { error, ctx } = await requireOrgAuth();
    if (error) return error;
    const { propertyId } = await params;
    const body = CreateChannelConnectionSchema.parse(await req.json());
    const connection = await channelConnectionService.create(
      ctx.organizationId,
      { propertyId, ...body },
      ctx.userId,
    );
    return NextResponse.json(connection, { status: 201 });
  } catch (err) {
    return handleApiError(err, "channel");
  }
}
