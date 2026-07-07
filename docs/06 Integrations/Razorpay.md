# Razorpay Integration

> Phase: 8
> Purpose: Indian subscription billing (primary payment method)

---

## Overview

Razorpay is the primary payment gateway for Indian customers. Supports UPI, netbanking, credit/debit cards. Used for subscription billing and invoice payments.

---

## Subscription Flow

```typescript
// src/domains/billing/providers/razorpay.provider.ts

import Razorpay from 'razorpay';

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

export class RazorpayProvider {
  async createSubscription(orgId: string, planId: string): Promise<{ subscriptionId: string; shortUrl: string }> {
    const plan = await subscriptionPlanRepo.findById(planId);

    const subscription = await razorpay.subscriptions.create({
      plan_id: plan.razorpay_plan_id,
      total_count: 12,  // 12 billing cycles (monthly)
      quantity: 1,
      notes: { organization_id: orgId },
    });

    await subscriptionRepo.create({
      organizationId: orgId,
      planId: plan.id,
      status: 'pending',
      razorpaySubId: subscription.id,
    });

    return {
      subscriptionId: subscription.id,
      shortUrl: subscription.short_url,  // Direct payment link for customer
    };
  }

  verifyWebhookSignature(body: string, signature: string): boolean {
    const expectedSignature = createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET!)
      .update(body)
      .digest('hex');
    return signature === expectedSignature;
  }

  async handleWebhook(event: RazorpayWebhookEvent): Promise<void> {
    switch (event.event) {
      case 'subscription.activated':
        await subscriptionService.activate(event.payload.subscription.entity.id);
        break;
      case 'subscription.charged':
        await subscriptionService.recordPayment(event.payload.subscription.entity);
        break;
      case 'subscription.cancelled':
        await subscriptionService.cancel(event.payload.subscription.entity.id);
        break;
      case 'payment.failed':
        await subscriptionService.handlePaymentFailed(event.payload.payment.entity);
        break;
    }
  }
}
```

---

## Client-Side Integration

```typescript
// In billing settings page:
const handleSubscribe = async (planId: string) => {
  const { subscriptionId, shortUrl } = await api.createSubscription(planId);

  // Option 1: Redirect to Razorpay hosted page
  window.location.href = shortUrl;

  // Option 2: Razorpay checkout modal (more seamless)
  const rzp = new window.Razorpay({
    key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
    subscription_id: subscriptionId,
    name: 'Airaroots',
    description: `${planName} Plan`,
    prefill: { name: user.fullName, email: user.email },
    handler: async (response) => {
      await api.verifyPayment(response);
      toast.success('Subscription activated!');
      router.push('/dashboard');
    },
  });
  rzp.open();
};
```

---

## Webhook Endpoint

```
POST /api/webhooks/razorpay
```

Required environment variables:
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`
