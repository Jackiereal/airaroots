import type { CommunicationTrigger, Channel } from './types';

export const TRIGGERS: CommunicationTrigger[] = [
  'booking_confirmation',
  'checkin_welcome',
  'checkout_thankyou',
];

export const TRIGGER_LABELS: Record<CommunicationTrigger, string> = {
  booking_confirmation: 'Booking confirmation',
  checkin_welcome: 'Check-in welcome',
  checkout_thankyou: 'Checkout thank-you',
};

// Which reservation lifecycle event fires each trigger.
export const TRIGGER_EVENTS: Record<CommunicationTrigger, string> = {
  booking_confirmation: 'reservation.created',
  checkin_welcome: 'reservation.checked_in',
  checkout_thankyou: 'reservation.checked_out',
};

// Placeholders the editor advertises and the handler fills. Keep in sync
// with buildVars() in communication.service.ts.
export const TEMPLATE_VARS = [
  'guest_name',
  'property_name',
  'check_in',
  'check_out',
  'nights',
] as const;

// Seed templates created per-org on first dispatch. Plain text, {{var}}
// placeholders. Default channel is whatsapp (guest phone is the most
// commonly populated contact field); email variants can be added in the
// editor later.
export const DEFAULT_TEMPLATES: Record<
  CommunicationTrigger,
  { channel: Channel; subject: string | null; body: string }
> = {
  booking_confirmation: {
    channel: 'whatsapp',
    subject: null,
    body:
      'Hi {{guest_name}}, your booking at {{property_name}} is confirmed! ' +
      'Check-in {{check_in}}, check-out {{check_out}} ({{nights}} nights). ' +
      'We look forward to hosting you.',
  },
  checkin_welcome: {
    channel: 'whatsapp',
    subject: null,
    body:
      'Welcome, {{guest_name}}! You are now checked in at {{property_name}}. ' +
      'Reach out any time if you need anything during your stay.',
  },
  checkout_thankyou: {
    channel: 'whatsapp',
    subject: null,
    body:
      'Thank you for staying at {{property_name}}, {{guest_name}}! ' +
      'We hope you enjoyed your visit. Safe travels.',
  },
};
