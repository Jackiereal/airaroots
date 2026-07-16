import { z } from 'zod';

// Shape validation for rule conditions/actions. Enforced on write in the API
// and re-parsed defensively in the engine before dispatch, since the jsonb
// columns carry no DB-level shape guarantee.

export const ConditionSchema = z.object({
  field: z.string().min(1).max(100),
  op: z.enum(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in']),
  value: z.unknown(),
});

export const ActionSchema = z.object({
  type: z.enum([
    'create_housekeeping_task',
    'create_maintenance_request',
    'send_notification',
    'create_calendar_block',
    'derive_direct_booking',
  ]),
  params: z.record(z.string(), z.unknown()).default({}),
});

// MVP: this slice only lets managers rename a rule or toggle it on/off.
// Editing conditions/actions is deferred to the full rule-builder slice.
export const UpdateRuleSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  isActive: z.boolean().optional(),
});

export type ConditionInput = z.infer<typeof ConditionSchema>;
export type ActionInput = z.infer<typeof ActionSchema>;
export type UpdateRuleInput = z.infer<typeof UpdateRuleSchema>;
