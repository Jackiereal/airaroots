import { z } from 'zod';

// Subscribe request body. The client sends ONLY the plan slug — the
// razorpay_plan_id and amount are resolved server-side from subscription_plans,
// never trusted from client input. Only the self-serve tiers are accepted:
// Pro (26–100) and Enterprise are handled via contact-us, not self-checkout.
export const SubscribeSchema = z.object({
  plan: z.enum(['starter', 'growth']),
});

export type SubscribeInput = z.infer<typeof SubscribeSchema>;
