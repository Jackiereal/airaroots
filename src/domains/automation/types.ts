// ─── Automation Engine domain types ──────────────────────────────────────────
// A rule maps ONE trigger (a domain event type) to an ordered list of actions,
// gated by optional conditions. The engine loads active rules for an org+trigger
// off the event bus, evaluates conditions against the event payload, and runs
// each action in order via the existing action services.

// Slice 1 is create-side only — the two triggers whose additive actions the
// engine owns. (Stateful modified/cancelled/checked_out stay in handlers.)
export type AutomationTrigger = 'reservation.created' | 'reservation.checked_in';

export type ConditionOp = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in';

// field is a dotted path into the flattened event payload (e.g.
// 'reservation.channel', 'reservation.nights'). value is compared with op.
export type Condition = {
  field: string;
  op: ConditionOp;
  value: unknown;
};

export type ActionType =
  | 'create_housekeeping_task'
  | 'create_maintenance_request'
  | 'send_notification'
  | 'create_calendar_block'
  | 'derive_direct_booking';

// params are literals or {{path}} bindings resolved against the event payload
// before dispatch. Identity fields (org/property/reservation ids) are NEVER
// taken from params — the dispatcher injects them from the trusted event.
export type Action = {
  type: ActionType;
  params: Record<string, unknown>;
};

export type AutomationRule = {
  id: string;
  organizationId: string;
  name: string;
  trigger: AutomationTrigger;
  conditions: Condition[];
  actions: Action[];
  isActive: boolean;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
};

export type RunStatus = 'success' | 'skipped' | 'failed';

export type RunLogEntry = {
  id: string;
  organizationId: string;
  ruleId: string | null;
  trigger: string;
  eventId: string;
  aggregateId: string | null;
  actionType: string;
  actionIndex: number;
  status: RunStatus;
  detail: Record<string, unknown>;
  createdAt: string;
};
