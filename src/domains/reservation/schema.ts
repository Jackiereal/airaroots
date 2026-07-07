import { z } from 'zod';

const channelEnum = z.enum(['airbnb', 'booking_com', 'direct', 'vrbo', 'expedia', 'other']);

export const CreateReservationSchema = z.object({
  organizationId: z.string().uuid(),
  propertyId: z.string().uuid(),
  guestId: z.string().uuid().optional(),
  channel: channelEnum,
  platformBookingId: z.string().max(200).optional(),
  checkIn: z.string().date(),
  checkOut: z.string().date(),
  adults: z.number().int().min(1).max(50),
  children: z.number().int().min(0).max(20).default(0),
  pets: z.number().int().min(0).max(10).default(0),
  nightlyRate: z.number().min(0),
  cleaningFee: z.number().min(0).default(0),
  taxes: z.number().min(0).default(0),
  otherFees: z.number().min(0).default(0),
  platformCommission: z.number().min(0).default(0),
  guestName: z.string().min(1).max(200).optional(),
  guestEmail: z.string().email().optional(),
  guestPhone: z.string().max(30).optional(),
  notes: z.string().max(2000).optional(),
  rawPayload: z.record(z.string(), z.unknown()).optional(),
}).refine(
  (d: { checkIn: string; checkOut: string }) => new Date(d.checkOut) > new Date(d.checkIn),
  { message: 'Check-out must be after check-in', path: ['checkOut'] }
);

export const UpdateReservationSchema = z.object({
  checkIn: z.string().date().optional(),
  checkOut: z.string().date().optional(),
  adults: z.number().int().min(1).max(50).optional(),
  children: z.number().int().min(0).max(20).optional(),
  pets: z.number().int().min(0).max(10).optional(),
  nightlyRate: z.number().min(0).optional(),
  cleaningFee: z.number().min(0).optional(),
  taxes: z.number().min(0).optional(),
  otherFees: z.number().min(0).optional(),
  platformCommission: z.number().min(0).optional(),
  guestName: z.string().min(1).max(200).optional(),
  guestEmail: z.string().email().optional(),
  guestPhone: z.string().max(30).optional(),
  notes: z.string().max(2000).optional(),
}).refine(
  (d: { checkIn?: string; checkOut?: string }) => {
    if (d.checkIn && d.checkOut) {
      return new Date(d.checkOut) > new Date(d.checkIn);
    }
    return true;
  },
  { message: 'Check-out must be after check-in', path: ['checkOut'] }
);

export const CancelReservationSchema = z.object({
  reason: z.string().min(1).max(500),
});

export type CreateReservationInput = z.infer<typeof CreateReservationSchema>;
export type UpdateReservationInput = z.infer<typeof UpdateReservationSchema>;
export type CancelReservationInput = z.infer<typeof CancelReservationSchema>;
