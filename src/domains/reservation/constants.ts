import type { ReservationStatus } from './types';

// Valid status transitions: key = from, value = allowed targets
export const VALID_STATUS_TRANSITIONS: Record<ReservationStatus, ReservationStatus[]> = {
  inquiry:      ['confirmed', 'cancelled'],
  confirmed:    ['checked_in', 'cancelled', 'no_show', 'conflict'],
  checked_in:   ['checked_out', 'cancelled', 'no_show'],
  checked_out:  [],  // terminal
  cancelled:    [],  // terminal
  no_show:      [],  // terminal
  conflict:     ['confirmed', 'cancelled'],
};

export const CHANNEL_LABELS: Record<string, string> = {
  airbnb:      'Airbnb',
  booking_com: 'Booking.com',
  direct:      'Direct',
  vrbo:        'VRBO',
  expedia:     'Expedia',
  other:       'Other',
};

export const CHANNEL_COLORS: Record<string, string> = {
  airbnb:      '#FF5A5F',
  booking_com: '#003580',
  direct:      '#22c55e',
  vrbo:        '#1B6FEC',
  expedia:     '#FFC72C',
  other:       '#6b7280',
};
