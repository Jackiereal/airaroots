import type { Plan } from './constants';

// Razorpay-native subscription status (superset of our org subscription_status).
export type RazorpaySubscriptionStatus =
  | 'created'
  | 'authenticated'
  | 'active'
  | 'pending'
  | 'halted'
  | 'cancelled'
  | 'completed'
  | 'expired';

export type SubscriptionPlanRow = {
  id: string;
  plan: Plan;
  razorpayPlanId: string;
  billingPeriod: 'monthly' | 'yearly';
  amountPaise: number | null;
  currency: string;
  totalCount: number;
  isActive: boolean;
};

export type SubscriptionRow = {
  id: string;
  organizationId: string;
  plan: Plan;
  razorpaySubscriptionId: string;
  razorpayPlanId: string;
  status: RazorpaySubscriptionStatus;
  shortUrl: string | null;
  currentPeriodEnd: string | null;
  createdAt: string;
  updatedAt: string;
};

// Minimal shape of the Razorpay webhook body — only the fields we read. The SDK
// doesn't ship a discriminated type for webhooks, so we describe our subset.
export type RazorpayWebhookEvent = {
  event: string; // 'subscription.activated' | 'subscription.charged' | ...
  payload: {
    subscription?: {
      entity: {
        id: string;
        status: string;
        plan_id?: string;
        current_end?: number | null; // unix seconds
        notes?: Record<string, string> | null;
      };
    };
    payment?: {
      entity: {
        id: string;
        amount: number; // paise
      };
    };
  };
};
