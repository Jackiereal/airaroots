import type { SupabaseClient } from '@supabase/supabase-js';
import type { Plan, SubscriptionStatus } from '../constants';
import type { SubscriptionPlanRow, RazorpayWebhookEvent } from '../types';

// Owns ALL billing state transitions — the only place that writes
// organizations.plan / organizations.subscription_status (the enforcement source
// of truth read by POST /api/properties). Uses the service-role client
// throughout (webhook has no auth.uid(); RLS money tables have no member write).
//
// New billing tables aren't in the hand-written DB type stubs, so reads/writes
// go through the loose client and rows are cast through `unknown`.

export class SubscriptionService {
  constructor(private db: SupabaseClient) {}

  // ─── Plan catalog ────────────────────────────────────────────────────────────
  async findActivePlan(plan: Plan): Promise<SubscriptionPlanRow | null> {
    const { data, error } = await this.db
      .from('subscription_plans')
      .select('*')
      .eq('plan', plan)
      .eq('is_active', true)
      .maybeSingle();

    if (error) throw new Error(`DB error: ${error.message}`);
    if (!data) return null;
    const r = data as Record<string, unknown>;
    return {
      id: r['id'] as string,
      plan: r['plan'] as Plan,
      razorpayPlanId: r['razorpay_plan_id'] as string,
      billingPeriod: r['billing_period'] as 'monthly' | 'yearly',
      amountPaise: (r['amount_paise'] as number | null) ?? null,
      currency: r['currency'] as string,
      totalCount: r['total_count'] as number,
      isActive: r['is_active'] as boolean,
    };
  }

  // ─── Live-subscription guard ──────────────────────────────────────────────────
  // A subscription that's mid-flight or paying — used to block double-subscribe.
  // 'created' is deliberately excluded: it means a Razorpay subscription object
  // exists but checkout was never completed (abandoned modal, failed attempt) —
  // no mandate, no money moved, so blocking retry here would strand the user.
  async hasLiveSubscription(organizationId: string): Promise<boolean> {
    const { data, error } = await this.db
      .from('subscriptions')
      .select('id')
      .eq('organization_id', organizationId)
      .in('status', ['authenticated', 'active', 'pending'])
      .limit(1);

    if (error) throw new Error(`DB error: ${error.message}`);
    return (data ?? []).length > 0;
  }

  // ─── Current subscription lookup (billing settings page) ──────────────────────
  // Most recent row in a billable state — what the settings page shows and what
  // "cancel" targets. Distinct from hasLiveSubscription: this also returns
  // 'halted' (past_due/dunning) so the UI can show a cancel option even mid-grace.
  async findCurrentSubscription(
    organizationId: string
  ): Promise<{ id: string; razorpaySubscriptionId: string; plan: Plan; status: string; currentPeriodEnd: string | null } | null> {
    const { data, error } = await this.db
      .from('subscriptions')
      .select('id, razorpay_subscription_id, plan, status, current_period_end')
      .eq('organization_id', organizationId)
      .in('status', ['authenticated', 'active', 'pending', 'halted'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(`DB error: ${error.message}`);
    if (!data) return null;
    const r = data as Record<string, unknown>;
    return {
      id: r['id'] as string,
      razorpaySubscriptionId: r['razorpay_subscription_id'] as string,
      plan: r['plan'] as Plan,
      status: r['status'] as string,
      currentPeriodEnd: (r['current_period_end'] as string | null) ?? null,
    };
  }

  // ─── Reconciliation ──────────────────────────────────────────────────────────
  // Subscriptions worth polling against the Razorpay API: anything not already
  // in a settled terminal state. 'created'/'authenticated' are included too —
  // a subscription stuck there might have actually activated via a webhook we
  // never received.
  async listReconcilableSubscriptions(): Promise<
    { organizationId: string; razorpaySubscriptionId: string; dbStatus: string }[]
  > {
    const { data, error } = await this.db
      .from('subscriptions')
      .select('organization_id, razorpay_subscription_id, status')
      .in('status', ['created', 'authenticated', 'active', 'pending', 'halted']);

    if (error) throw new Error(`DB error: ${error.message}`);
    return (data ?? []).map((r) => ({
      organizationId: (r as { organization_id: string }).organization_id,
      razorpaySubscriptionId: (r as { razorpay_subscription_id: string }).razorpay_subscription_id,
      dbStatus: (r as { status: string }).status,
    }));
  }

  // ─── Persist the subscription created by the subscribe route ──────────────────
  async persistCreatedSubscription(args: {
    organizationId: string;
    plan: Plan;
    razorpaySubscriptionId: string;
    razorpayPlanId: string;
    shortUrl: string | null;
    status: string;
  }): Promise<void> {
    const { error } = await this.db.from('subscriptions').insert({
      organization_id: args.organizationId,
      plan: args.plan,
      razorpay_subscription_id: args.razorpaySubscriptionId,
      razorpay_plan_id: args.razorpayPlanId,
      status: args.status ?? 'created',
      short_url: args.shortUrl,
    });
    if (error) throw new Error(`DB error: ${error.message}`);
  }

  // ─── Idempotent webhook handling ──────────────────────────────────────────────
  // Insert-first on the event ledger (unique razorpay_event_id) is the dedup
  // guard: a retried/replayed event hits 23505 and we skip. State transitions are
  // themselves idempotent, so even a mid-crash retry converges.
  async handleWebhookEvent(args: {
    eventId: string;
    event: RazorpayWebhookEvent;
  }): Promise<{ deduped: boolean }> {
    const { eventId, event } = args;
    const subEntity = event.payload.subscription?.entity;
    const payEntity = event.payload.payment?.entity;
    const organizationId = subEntity?.notes?.['organization_id'] ?? null;

    // 1. Dedup guard — insert the ledger row first.
    const { error: ledgerError } = await this.db.from('billing_events').insert({
      organization_id: organizationId,
      razorpay_event_id: eventId,
      event_type: event.event,
      razorpay_subscription_id: subEntity?.id ?? null,
      razorpay_payment_id: payEntity?.id ?? null,
      amount_paise: payEntity?.amount ?? null,
      payload: event as unknown as Record<string, unknown>,
    });

    if (ledgerError) {
      // Unique violation on razorpay_event_id → already processed. Ack, skip.
      if (/duplicate key|unique|23505/i.test(ledgerError.message)) {
        return { deduped: true };
      }
      throw new Error(`DB error: ${ledgerError.message}`);
    }

    // 2. Resolve org (fallback: look up the subscription row by razorpay id).
    const orgId = organizationId ?? (await this.resolveOrgFromSubscription(subEntity?.id));
    if (!orgId || !subEntity) return { deduped: false };

    // 3. Apply the transition.
    await this.applyTransition(orgId, event.event, subEntity, payEntity);
    return { deduped: false };
  }

  private async resolveOrgFromSubscription(
    razorpaySubscriptionId: string | undefined
  ): Promise<string | null> {
    if (!razorpaySubscriptionId) return null;
    const { data } = await this.db
      .from('subscriptions')
      .select('organization_id')
      .eq('razorpay_subscription_id', razorpaySubscriptionId)
      .maybeSingle();
    return (data as { organization_id?: string } | null)?.organization_id ?? null;
  }

  // Maps a Razorpay event to (a) the subscriptions row status and (b) the
  // organizations.plan / subscription_status mirror that actually gates the cap.
  private async applyTransition(
    organizationId: string,
    eventType: string,
    subEntity: NonNullable<RazorpayWebhookEvent['payload']['subscription']>['entity'],
    payEntity: NonNullable<RazorpayWebhookEvent['payload']['payment']>['entity'] | undefined
  ): Promise<void> {
    void payEntity; // charge details already persisted in billing_events

    const periodEnd = subEntity.current_end
      ? new Date(subEntity.current_end * 1000).toISOString()
      : undefined;

    // 'subscription.pending' and 'payment.failed' carry a Razorpay subscription
    // status ('active' or 'pending') that doesn't by itself mean past_due — the
    // event TYPE is what signals dunning here, the raw status doesn't. Map those
    // two event types to the 'halted' status bucket in syncOrgFromStatus's terms
    // so both paths (webhook event vs cron-polled status) converge on the same
    // org-mirror logic.
    const effectiveStatus =
      eventType === 'subscription.pending' || eventType === 'payment.failed'
        ? 'halted'
        : subEntity.status;

    await this.syncOrgFromStatus(organizationId, subEntity.id, effectiveStatus, periodEnd);
  }

  // ─── Shared status → org-mirror logic (webhook + reconciliation cron) ─────────
  // Given a Razorpay subscription's CURRENT status (from a webhook entity or a
  // polled subscriptions.fetch()), updates our subscriptions row and mirrors the
  // right organizations.plan/subscription_status. This is the single source of
  // truth for "what does this Razorpay status mean for the org" — both the
  // webhook handler and the reconciliation cron call it so they can never drift.
  async syncOrgFromStatus(
    organizationId: string,
    razorpaySubscriptionId: string,
    status: string,
    currentPeriodEnd?: string
  ): Promise<void> {
    // The plan this subscription is for — read from our own subscriptions row
    // (never trust the webhook's/API's plan_id for gating).
    const plan = await this.planForSubscription(razorpaySubscriptionId);

    await this.updateSubscriptionRow(razorpaySubscriptionId, status, currentPeriodEnd);

    let orgStatus: SubscriptionStatus | null = null;
    let orgPlan: Plan | null = null;

    switch (status) {
      case 'active':
      case 'completed':
        orgStatus = 'active';
        if (plan) orgPlan = plan;
        break;
      case 'pending':
      case 'halted':
        // Grace: flag past_due but KEEP the plan — don't cap a paying customer
        // mid-dunning.
        orgStatus = 'past_due';
        break;
      case 'cancelled':
      case 'expired':
        orgStatus = 'cancelled';
        orgPlan = 'solo'; // revert to lowest tier (existing props untouched)
        break;
      default:
        return; // 'created' / 'authenticated' — no mandate yet, no org change
    }

    const patch: Record<string, unknown> = {};
    if (orgStatus) patch['subscription_status'] = orgStatus;
    if (orgPlan) patch['plan'] = orgPlan;
    if (Object.keys(patch).length === 0) return;

    const { error } = await this.db.from('organizations').update(patch).eq('id', organizationId);
    if (error) throw new Error(`DB error: ${error.message}`);
  }

  private async planForSubscription(razorpaySubscriptionId: string): Promise<Plan | null> {
    const { data } = await this.db
      .from('subscriptions')
      .select('plan')
      .eq('razorpay_subscription_id', razorpaySubscriptionId)
      .maybeSingle();
    return (data as { plan?: Plan } | null)?.plan ?? null;
  }

  private async updateSubscriptionRow(
    razorpaySubscriptionId: string,
    status: string,
    currentPeriodEnd?: string
  ): Promise<void> {
    const patch: Record<string, unknown> = { status };
    if (currentPeriodEnd) patch['current_period_end'] = currentPeriodEnd;
    const { error } = await this.db
      .from('subscriptions')
      .update(patch)
      .eq('razorpay_subscription_id', razorpaySubscriptionId);
    if (error) throw new Error(`DB error: ${error.message}`);
  }
}
