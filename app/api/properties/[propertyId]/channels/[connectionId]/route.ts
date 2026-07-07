import { NextResponse } from 'next/server';
import { requireOrgAuth } from '@/src/shared/utils/route-auth';
import { handleApiError } from '@/src/shared/utils/api-error-handler';
import { channelConnectionService } from '@/src/domains/channel/services/channel-connection.service';
import { channelSyncService } from '@/src/domains/channel/services/channel-sync.service';
import { channelRepository } from '@/src/domains/channel/repositories/channel.repository';
import { z } from 'zod';

const UpdateSchema = z.object({
  icalUrl: z.string().url().optional(),
  status: z.enum(['active', 'paused']).optional(),
});

type Params = { params: Promise<{ propertyId: string; connectionId: string }> };

export async function PATCH(req: Request, { params }: Params) {
  try {
    const { error, ctx } = await requireOrgAuth();
    if (error) return error;
    const { connectionId } = await params;
    const body = UpdateSchema.parse(await req.json());
    const connection = await channelConnectionService.update(connectionId, ctx.organizationId, body);
    return NextResponse.json(connection);
  } catch (err) {
    return handleApiError(err, "channel");
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { error, ctx } = await requireOrgAuth();
    if (error) return error;
    const { connectionId } = await params;
    await channelConnectionService.delete(connectionId, ctx.organizationId);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return handleApiError(err, "channel");
  }
}

// POST /api/properties/[id]/channels/[connectionId] — manual sync trigger
export async function POST(_req: Request, { params }: Params) {
  try {
    const { error, ctx } = await requireOrgAuth();
    if (error) return error;
    const { connectionId } = await params;
    const connection = await channelRepository.findById(connectionId);
    if (!connection || connection.organizationId !== ctx.organizationId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const result = await channelSyncService.syncConnection(connection, 'manual');
    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err, "channel");
  }
}
