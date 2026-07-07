export async function register() {
  // Only run in Node.js runtime (not Edge), and only in production or when explicitly enabled
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (process.env.NODE_ENV !== 'production' && !process.env.ENABLE_CRON_IN_DEV) return;

  const INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

  const runSync = async () => {
    try {
      const { channelSyncService } = await import(
        './src/domains/channel/services/channel-sync.service'
      );
      const results = await channelSyncService.syncAll('cron');
      const created = results.reduce((n, r) => n + r.reservationsCreated, 0);
      const failed = results.filter(r => r.status === 'failed').length;
      console.log(
        `[cron] sync done — ${results.length} connections, ${created} created, ${failed} failed`,
      );
    } catch (err) {
      console.error('[cron] sync error:', err);
    }
  };

  // Initial run shortly after startup (30s delay so DB connections settle)
  setTimeout(runSync, 30_000);
  // Then every 15 minutes
  setInterval(runSync, INTERVAL_MS);

  console.log('[cron] channel sync scheduled every 15 minutes');
}
