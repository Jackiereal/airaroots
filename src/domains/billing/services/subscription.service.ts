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
  async hasLiveSubscription(organizationId: string): Promise<boolean> {
    const { data, error } = await this.db
      .from('subscriptions')
      .select('id')
      .eq('organization_id', organizationId)
      .in('status', ['created', 'authenticated', 'active', 'pending'])
      .limit(1);

    if (error) throw new Error(`DB error: ${error.message}`);
    return (data ?? []).length > 0;
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
    const razorpaySubscriptionId = subEntity.id;

    // The plan this subscription is for — read from our own subscriptions row
    // (never trust the webhook's plan_id for gating).
    const plan = await this.planForSubscription(razorpaySubscriptionId);

    // Sub-row status + current_period_end from the entity.
    const subStatus = subEntity.status;
    const periodEnd = subEntity.current_end
      ? new Date(subEntity.current_end * 1000).toISOString()
      : undefined;

    await this.updateSubscriptionRow(razorpaySubscriptionId, subStatus, periodEnd);

    // organizations mirror — see the transition map in the plan.
    let orgStatus: SubscriptionStatus | null = null;
    let orgPlan: Plan | null = null;

    switch (eventType) {
      case 'subscription.activated':
      case 'subscription.charged':
      case 'subscription.completed':
        orgStatus = 'active';
        if (plan) orgPlan = plan; // completed keeps plan; activated/charged set it
        break;
      case 'subscription.pending':
      case 'payment.failed':
      case 'subscription.halted':
        // Grace: flag past_due but KEEP the plan — don't cap a paying customer
        // mid-dunning.
        orgStatus = 'past_due';
        break;
      case 'subscription.cancelled':
        orgStatus = 'cancelled';
        orgPlan = 'solo'; // revert to lowest tier (existing props untouched)
        break;
      default:
        return; // unhandled event → ledger recorded, no org change
    }

    void payEntity; // charge details already persisted in billing_events

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
