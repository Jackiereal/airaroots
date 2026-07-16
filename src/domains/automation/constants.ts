import type { AutomationTrigger, ActionType, Condition, Action } from './types';

export const TRIGGERS: AutomationTrigger[] = ['reservation.created', 'reservation.checked_in'];

export const TRIGGER_LABELS: Record<AutomationTrigger, string> = {
  'reservation.created': 'Reservation created',
  'reservation.checked_in': 'Guest checked in',
};

export const ACTION_LABELS: Record<ActionType, string> = {
  create_housekeeping_task: 'Create housekeeping task',
  create_maintenance_request: 'Create maintenance request',
  send_notification: 'Send notification',
  create_calendar_block: 'Block the calendar',
  derive_direct_booking: 'Record direct-booking revenue',
};

// Fields available to conditions per trigger, surfaced in the read-only rule
// summary (and, later, the builder). Dotted paths into the flattened payload.
export const AVAILABLE_FIELDS: Record<AutomationTrigger, string[]> = {
  'reservation.created': [
    'reservation.channel',
    'reservation.nights',
    'reservation.adults',
    'reservation.children',
    'reservation.netPayout',
  ],
  'reservation.checked_in': ['reservation.channel', 'reservation.nights'],
};

// ─── Seeded default rules ─────────────────────────────────────────────────────
// Mirror the CURRENT create-side handler behavior exactly (calendar.handler,
// finance.handler, housekeeping.handler). Seeded per-org as is_system rules,
// INACTIVE by default — activating one is the deliberate cutover switch that
// replaces the corresponding hardcoded handler (see the phased strangler plan).
// Params use {{path}} bindings resolved against the event payload; identity
// fields (org/property/reservation ids) are injected by the dispatcher, never
// bound here.
export type DefaultRule = {
  name: string;
  trigger: AutomationTrigger;
  conditions: Condition[];
  actions: Action[];
};

export const DEFAULT_RULES: DefaultRule[] = [
  {
    name: 'Housekeeping cleanup on check-in',
    trigger: 'reservation.checked_in',
    conditions: [],
    actions: [
      {
        type: 'create_housekeeping_task',
        params: {
          taskType: 'checkout_clean',
          scheduledDate: '{{reservation.checkOut}}',
          scheduledTime: '14:00',
        },
      },
    ],
  },
  {
    name: 'Block calendar on reservation',
    trigger: 'reservation.created',
    conditions: [],
    actions: [
      {
        type: 'create_calendar_block',
        params: {
          blockType: 'reservation',
          startDate: '{{reservation.checkIn}}',
          endDate: '{{reservation.checkOut}}',
          isPublic: true,
        },
      },
    ],
  },
  {
    name: 'Record direct-booking revenue',
    trigger: 'reservation.created',
    conditions: [{ field: 'reservation.channel', op: 'eq', value: 'direct' }],
    actions: [{ type: 'derive_direct_booking', params: {} }],
  },
];
