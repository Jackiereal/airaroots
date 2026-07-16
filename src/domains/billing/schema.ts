import { z } from 'zod';

// Subscribe request body. The client sends ONLY the plan slug — the
// razorpay_plan_id and amount are resolved server-side from subscription_plans,
// never trusted from client input. Enterprise is excluded (custom / contact-us).
export const SubscribeSchema = z.object({
  plan: z.enum(['starter', 'growth', 'pro']),
});

export type SubscribeInput = z.infer<typeof SubscribeSchema>;
