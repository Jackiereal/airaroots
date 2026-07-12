import type { NotificationTrigger, Channel } from './types';

export const TRIGGERS: NotificationTrigger[] = [
  'housekeeping_assignment',
  'housekeeping_reminder',
  'vendor_dispatch',
  'reservation_confirmed',
  'checkout_thankyou',
];

export const TRIGGER_LABELS: Record<NotificationTrigger, string> = {
  housekeeping_assignment: 'Housekeeping — task assigned',
  housekeeping_reminder: 'Housekeeping — reminder',
  vendor_dispatch: 'Vendor — maintenance dispatch',
  reservation_confirmed: 'Guest — booking confirmed',
  checkout_thankyou: 'Guest — checkout thank-you',
};

// Placeholders each trigger's template can use, surfaced in the editor.
// Keep in sync with the vars each caller passes to NotificationService.notify.
export const TRIGGER_VARS: Record<NotificationTrigger, string[]> = {
  housekeeping_assignment: ['staff_name', 'property_name', 'date', 'time', 'task_type', 'checklist_url'],
  housekeeping_reminder: ['staff_name', 'property_name', 'time', 'checklist_url'],
  vendor_dispatch: ['vendor_name', 'priority', 'category', 'title', 'request_url'],
  reservation_confirmed: ['guest_name', 'property_name', 'check_in', 'check_out', 'nights'],
  checkout_thankyou: ['guest_name', 'property_name'],
};

// Seed templates created per-org on first use. Bodies mirror the current
// hardcoded wa.me text (housekeeping.service.ts / maintenance.service.ts +
// HousekeepingBoard.tsx) so switching to templates changes nothing until a
// manager edits them.
export const DEFAULT_TEMPLATES: Record<
  NotificationTrigger,
  { channel: Channel; subject: string | null; body: string }
> = {
  housekeeping_assignment: {
    channel: 'whatsapp',
    subject: null,
    body:
      'Hi {{staff_name}}, you have a {{task_type}} task at {{property_name}} scheduled for ' +
      '{{date}} at {{time}}.\n\nOpen task: {{checklist_url}}',
  },
  housekeeping_reminder: {
    channel: 'whatsapp',
    subject: null,
    body: 'Reminder: {{property_name}} cleaning today by {{time}}. Checklist: {{checklist_url}}',
  },
  vendor_dispatch: {
    channel: 'whatsapp',
    subject: null,
    body:
      "Hi {{vendor_name}}, there's a {{priority}} priority {{category}} issue. " +
      'Title: {{title}}. Tap here for details: {{request_url}}',
  },
  reservation_confirmed: {
    channel: 'whatsapp',
    subject: null,
    body:
      'Hi {{guest_name}}, your booking at {{property_name}} is confirmed! ' +
      'Check-in {{check_in}}, check-out {{check_out}} ({{nights}} nights).',
  },
  checkout_thankyou: {
    channel: 'whatsapp',
    subject: null,
    body: 'Thank you for staying at {{property_name}}, {{guest_name}}! Safe travels.',
  },
};
