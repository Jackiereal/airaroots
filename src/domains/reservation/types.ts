export type ReservationChannel = 'airbnb' | 'booking_com' | 'direct' | 'vrbo' | 'expedia' | 'other';

export type ReservationStatus =
  | 'inquiry'
  | 'confirmed'
  | 'checked_in'
  | 'checked_out'
  | 'cancelled'
  | 'no_show'
  | 'conflict';

export type Reservation = {
  id: string;
  organizationId: string;
  propertyId: string;
  guestId: string | undefined;
  channel: ReservationChannel;
  platformBookingId: string | undefined;
  checkIn: string;    // YYYY-MM-DD
  checkOut: string;   // YYYY-MM-DD
  nights: number;
  adults: number;
  children: number;
  pets: number;
  status: ReservationStatus;
  nightlyRate: number;
  cleaningFee: number;
  taxes: number;
  otherFees: number;
  grossRevenue: number;
  platformCommission: number;
  netPayout: number;
  guestName: string | undefined;
  guestEmail: string | undefined;
  guestPhone: string | undefined;
  notes: string | undefined;
  rawPayload: Record<string, unknown> | undefined;
  createdBy: string | undefined;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | undefined;
};

export type CreateReservationInput = {
  organizationId: string;
  propertyId: string;
  guestId?: string;
  channel: ReservationChannel;
  platformBookingId?: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children?: number;
  pets?: number;
  nightlyRate: number;
  cleaningFee?: number;
  taxes?: number;
  otherFees?: number;
  platformCommission?: number;
  guestName?: string;
  guestEmail?: string;
  guestPhone?: string;
  notes?: string;
  rawPayload?: Record<string, unknown>;
};

export type UpdateReservationInput = Partial<
  Pick<
    CreateReservationInput,
    | 'checkIn'
    | 'checkOut'
    | 'adults'
    | 'children'
    | 'pets'
    | 'nightlyRate'
    | 'cleaningFee'
    | 'taxes'
    | 'otherFees'
    | 'platformCommission'
    | 'guestName'
    | 'guestEmail'
    | 'guestPhone'
    | 'notes'
  >
>;

export type ReservationEvent = {
  id: string;
  reservationId: string;
  organizationId: string;
  eventType: string;
  fromStatus: ReservationStatus | undefined;
  toStatus: ReservationStatus | undefined;
  actorId: string | undefined;
  notes: string | undefined;
  metadata: Record<string, unknown> | undefined;
  occurredAt: string;
};

export type ConflictResult = {
  hasConflict: boolean;
  conflicts: Array<{
    id: string;
    checkIn: string;
    checkOut: string;
    guestName: string | null;
    status: ReservationStatus;
  }>;
};
