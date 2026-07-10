import { NextResponse } from 'next/server';
import { requirePropertyAccess } from '@/src/shared/utils/route-auth';
import { handleApiError } from '@/src/shared/utils/api-error-handler';
import { channelConnectionService } from '@/src/domains/channel/services/channel-connection.service';

type Params = { params: Promise<{ propertyId: string; connectionId: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const { propertyId, connectionId } = await params;
    const { error, ctx } = await requirePropertyAccess(propertyId);
    if (error) return error;
    const logs = await channelConnectionService.getRecentLogs(connectionId, ctx.organizationId);
    return NextResponse.json(logs);
  } catch (err) {
    return handleApiError(err, "channel");
  }
}
