# Background Job Architecture

---

## Overview

Background jobs handle operations that:
- Are too slow for an HTTP request (channel syncs, report generation)
- Must happen at a scheduled time (pre-arrival messages, monthly reports)
- Need reliable retry on failure (webhook processing, communications)
- Should not block the user (AI analysis)

---

## Phase 1–7 Implementation: Database Queue

Using `background_jobs` table as a queue. A worker process polls the table.

**Why this approach:**
- Zero new infrastructure
- Debuggable via SQL
- Leverages existing Supabase connection
- Easy to monitor via admin dashboard

**Limitations:**
- Not designed for >10k jobs/day
- Worker must be running (Supabase Edge Function or Vercel Cron)
- No built-in fan-out or complex DAG support

**Migration path:** Replace with Inngest or Trigger.dev in Phase 8 when needed.

---

## Job Table Schema

```sql
CREATE TABLE background_jobs (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid REFERENCES organizations(id),
  queue           text NOT NULL DEFAULT 'default',
  type            text NOT NULL,
  payload         jsonb NOT NULL DEFAULT '{}',
  status          text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'dead')),
  priority        int NOT NULL DEFAULT 5,  -- 1 = highest, 10 = lowest
  attempts        int NOT NULL DEFAULT 0,
  max_attempts    int NOT NULL DEFAULT 3,
  scheduled_at    timestamptz NOT NULL DEFAULT now(),
  started_at      timestamptz,
  completed_at    timestamptz,
  failed_at       timestamptz,
  error           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_jobs_pending ON background_jobs(status, scheduled_at, priority)
  WHERE status = 'pending';
CREATE INDEX idx_jobs_org ON background_jobs(organization_id);
CREATE INDEX idx_jobs_type ON background_jobs(type);
```

---

## Job Enqueue API

```typescript
// src/infrastructure/jobs/job-queue.ts

interface EnqueueOptions {
  organizationId?: string;
  queue?: string;
  priority?: number;
  scheduledAt?: Date;
  maxAttempts?: number;
}

export async function enqueueJob(
  type: string,
  payload: Record<string, unknown>,
  opts: EnqueueOptions = {}
): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from('background_jobs')
    .insert({
      organization_id: opts.organizationId,
      queue: opts.queue ?? 'default',
      type,
      payload,
      priority: opts.priority ?? 5,
      scheduled_at: (opts.scheduledAt ?? new Date()).toISOString(),
      max_attempts: opts.maxAttempts ?? 3,
    })
    .select('id')
    .single();

  if (error) throw new Error(`Failed to enqueue job: ${error.message}`);
  return data.id;
}

// Schedule a future job
export async function scheduleJob(
  type: string,
  payload: Record<string, unknown>,
  runAt: Date,
  opts: EnqueueOptions = {}
): Promise<string> {
  return enqueueJob(type, payload, { ...opts, scheduledAt: runAt });
}
```

---

## Worker Implementation

```typescript
// src/infrastructure/jobs/job-processor.ts

const JOB_HANDLERS: Map<string, JobHandler> = new Map([
  ['channel.sync_airbnb', ChannelHandlers.syncAirbnb],
  ['channel.sync_booking_com', ChannelHandlers.syncBookingCom],
  ['channel.push_rates_airbnb', ChannelHandlers.pushRatesAirbnb],
  ['channel.process_webhook', ChannelHandlers.processWebhook],
  ['communication.send_booking_confirmation', CommHandlers.sendBookingConfirmation],
  ['communication.send_pre_arrival', CommHandlers.sendPreArrival],
  ['communication.send_checkout_message', CommHandlers.sendCheckout],
  ['communication.send_review_request', CommHandlers.sendReviewRequest],
  ['finance.create_revenue_entry', FinanceHandlers.createRevenueEntry],
  ['housekeeping.create_checkout_task', HousekeepingHandlers.createCheckoutTask],
  ['reports.generate_monthly_owner', ReportsHandlers.generateMonthlyOwner],
  ['ai.run_pricing_analysis', AIHandlers.runPricingAnalysis],
  ['ai.run_occupancy_forecast', AIHandlers.runOccupancyForecast],
]);

export async function processNextBatch(batchSize = 10): Promise<void> {
  // Claim jobs atomically to prevent double-processing
  const { data: jobs } = await supabaseAdmin.rpc('claim_pending_jobs', {
    batch_size: batchSize,
    worker_id: WORKER_ID,
  });

  await Promise.allSettled(jobs.map(processJob));
}

async function processJob(job: BackgroundJob): Promise<void> {
  const handler = JOB_HANDLERS.get(job.type);
  if (!handler) {
    logger.error(`No handler for job type: ${job.type}`, { jobId: job.id });
    await markJobDead(job.id, `Unknown job type: ${job.type}`);
    return;
  }

  try {
    await handler(job.payload, { jobId: job.id, organizationId: job.organization_id });
    await markJobCompleted(job.id);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.warn(`Job failed: ${job.type}`, { jobId: job.id, error: errorMessage, attempt: job.attempts });

    if (job.attempts + 1 >= job.max_attempts) {
      await markJobDead(job.id, errorMessage);
      await alertOnDeadJob(job, errorMessage);
    } else {
      await scheduleRetry(job.id, errorMessage, backoffDelay(job.attempts));
    }
  }
}

function backoffDelay(attempt: number): Date {
  // 1min, 5min, 25min, 2hr, 10hr
  const delayMs = Math.pow(5, attempt) * 60 * 1000;
  return new Date(Date.now() + delayMs);
}
```

---

## Claim Jobs — PostgreSQL Function

```sql
-- Atomically claims a batch of pending jobs for a worker
CREATE OR REPLACE FUNCTION claim_pending_jobs(batch_size int, worker_id text)
RETURNS SETOF background_jobs AS $$
  UPDATE background_jobs
  SET
    status = 'processing',
    started_at = now(),
    attempts = attempts + 1
  WHERE id IN (
    SELECT id FROM background_jobs
    WHERE status = 'pending'
    AND scheduled_at <= now()
    ORDER BY priority ASC, scheduled_at ASC
    LIMIT batch_size
    FOR UPDATE SKIP LOCKED   -- prevent double-claim
  )
  RETURNING *;
$$ LANGUAGE SQL;
```

---

## Scheduled Jobs (Cron)

Use Vercel Cron Jobs to trigger the worker:

```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/jobs/process",
      "schedule": "* * * * *"  // every minute
    },
    {
      "path": "/api/jobs/sync-channels",
      "schedule": "*/15 * * * *"  // every 15 minutes
    },
    {
      "path": "/api/jobs/pre-arrival-messages",
      "schedule": "0 8 * * *"   // 8am daily
    },
    {
      "path": "/api/jobs/monthly-reports",
      "schedule": "0 0 1 * *"   // 1st of month, midnight
    },
    {
      "path": "/api/jobs/ai-analysis",
      "schedule": "0 2 * * 0"   // Sunday 2am
    }
  ]
}
```

---

## Job Catalog

Complete list of all background jobs in the system:

| Job Type | Queue | Max Attempts | Trigger | Description |
|----------|-------|-------------|---------|-------------|
| `channel.sync_airbnb` | channel | 3 | Cron every 15min | Pull reservation updates from Airbnb |
| `channel.sync_booking_com` | channel | 3 | Cron every 15min | Pull reservation updates from Booking.com |
| `channel.push_rates_airbnb` | channel | 3 | Rate change event | Push rate update to Airbnb listing |
| `channel.push_rates_booking_com` | channel | 3 | Rate change event | Push rate update to Booking.com listing |
| `channel.push_availability` | channel | 3 | Block/unblock event | Push availability change to channels |
| `channel.process_webhook` | channel | 5 | Webhook received | Process inbound channel webhook |
| `communication.send_booking_confirmation` | comm | 3 | reservation.created | Send booking confirmation to guest |
| `communication.send_pre_arrival` | comm | 3 | Cron 8am or 48hr before | Send pre-arrival instructions |
| `communication.send_checkout_message` | comm | 3 | At checkout time | Send checkout message and access code |
| `communication.send_review_request` | comm | 2 | 24hr after checkout | Request review from guest |
| `communication.send_payment_reminder` | comm | 2 | Scheduled | Payment reminder for direct bookings |
| `finance.create_revenue_entry` | finance | 5 | reservation.created | Create revenue record from reservation |
| `finance.update_revenue_entry` | finance | 5 | reservation.modified | Update revenue record |
| `finance.void_revenue_entry` | finance | 5 | reservation.cancelled | Void revenue record |
| `housekeeping.create_checkout_task` | ops | 3 | reservation.checked_out | Create cleaning task for housekeeper |
| `housekeeping.create_maintenance_alert` | ops | 3 | maintenance.reported | Alert manager of new maintenance issue |
| `reports.generate_monthly_owner` | reports | 3 | Cron 1st of month | Generate owner monthly report |
| `reports.send_owner_report_email` | comm | 2 | After report generated | Email owner report |
| `ai.run_pricing_analysis` | ai | 1 | Cron Sunday midnight | Generate pricing recommendations |
| `ai.run_occupancy_forecast` | ai | 1 | Cron Sunday midnight | Update occupancy forecasts |
| `ai.detect_expense_anomalies` | ai | 1 | Cron daily | Check for anomalous expenses |

---

## Monitoring Background Jobs

Admin dashboard shows:
- Pending jobs by type and queue
- Failed jobs needing attention
- Dead letter queue
- Jobs processed per hour
- Average processing time per job type

Query for admin health check:
```sql
SELECT
  type,
  status,
  COUNT(*) as count,
  MAX(attempts) as max_attempts,
  MIN(scheduled_at) as oldest_pending
FROM background_jobs
WHERE created_at > now() - interval '24 hours'
GROUP BY type, status
ORDER BY status, count DESC;
```
