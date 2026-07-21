import { z } from 'zod';

// Subscribe request body. The client sends ONLY the plan slug — the
// razorpay_plan_id and amount are resolved server-side from subscription_plans,
// never trusted from client input. All four are self-serve; only Enterprise
// (25+ properties) is handled via contact-us, not self-checkout.
export const SubscribeSchema = z.object({
  plan: z.enum(['solo', 'small', 'growth', 'pro']),
});

export type SubscribeInput = z.infer<typeof SubscribeSchema>;
