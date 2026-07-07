# Stripe Integration

> Phase: 8
> Purpose: International subscription billing

---

## Overview

Stripe handles subscription billing for non-Indian customers. Indian customers use Razorpay. Both gateways produce invoices in the same format.

---

## Implementation

```typescript
// src/domains/billing/providers/stripe.provider.ts

import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-09-30.acacia' });

export class StripeProvider {
  async createSubscription(orgId: string, planId: string, paymentMethodId: string): Promise<Subscription> {
    const plan = await subscriptionPlanRepo.findById(planId);

    const customer = await stripe.customers.create({
      metadata: { organization_id: orgId },
    });

    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: plan.stripe_price_id }],
      payment_behavior: 'default_incomplete',
      payment_settings: { payment_method_types: ['card'] },
      default_payment_method: paymentMethodId,
      expand: ['latest_invoice.payment_intent'],
    });

    return subscriptionRepo.create({
      organizationId: orgId,
      planId: plan.id,
      status: 'active',
      stripeSubId: subscription.id,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    });
  }

  async handleWebhook(rawBody: string, signature: string): Promise<void> {
    const event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );

    switch (event.type) {
      case 'invoice.paid':
        await subscriptionService.markInvoicePaid(event.data.object as Stripe.Invoice);
        break;
      case 'invoice.payment_failed':
        await subscriptionService.handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      case 'customer.subscription.deleted':
        await subscriptionService.handleCancellation(event.data.object as Stripe.Subscription);
        break;
    }
  }
}
```

---

## Webhook Endpoint

```
POST /api/webhooks/stripe
```

Verifies Stripe signature with `stripe.webhooks.constructEvent`.
