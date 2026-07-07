import { NextResponse } from 'next/server';
import { channelSyncService } from '@/src/domains/channel/services/channel-sync.service';

// Called by Railway cron every 15 minutes.
// Protected by CRON_SECRET header.
export async function POST(request: Request) {
  const secret = request.headers.get('x-cron-secret');
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const results = await channelSyncService.syncAll('cron');

    const summary = {
      total: results.length,
      success: results.filter(r => r.status === 'success').length,
      partial: results.filter(r => r.status === 'partial').length,
      failed: results.filter(r => r.status === 'failed').length,
      reservationsCreated: results.reduce((n, r) => n + r.reservationsCreated, 0),
      reservationsUpdated: results.reduce((n, r) => n + r.reservationsUpdated, 0),
      conflictsDetected: results.reduce((n, r) => n + r.conflictsDetected, 0),
    };

    return NextResponse.json({ ok: true, summary, results });
  } catch (err) {
    console.error('[cron/sync-channels]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Sync failed' },
      { status: 500 },
    );
  }
}
