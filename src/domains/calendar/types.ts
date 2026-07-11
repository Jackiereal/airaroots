export type CalendarBlockType = 'reservation' | 'owner_hold' | 'maintenance' | 'buffer' | 'seasonal_close';

export type CalendarBlock = {
  id: string;
  organizationId: string;
  propertyId: string;
  reservationId: string | undefined;
  startDate: string;   // YYYY-MM-DD
  endDate: string;     // YYYY-MM-DD (exclusive, same convention as reservation checkOut)
  blockType: CalendarBlockType;
  reason: string | undefined;
  isPublic: boolean;
  createdBy: string | undefined;
  createdAt: string;
  updatedAt: string;
};

export type SeasonalRate = {
  id: string;
  organizationId: string;
  propertyId: string;
  name: string;
  startDate: string;
  endDate: string;
  nightlyRate: number;
  minNights: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AvailabilityResult = {
  available: boolean;
  blockedBy: CalendarBlock[];
};

export type CreateBlockInput = {
  organizationId: string;
  propertyId: string;
  reservationId?: string;
  startDate: string;
  endDate: string;
  blockType: CalendarBlockType;
  reason?: string;
  isPublic?: boolean;
};

export type UpdateBlockInput = Partial<
  Pick<CreateBlockInput, 'startDate' | 'endDate' | 'reason' | 'isPublic'>
>;

export type CreateSeasonalRateInput = {
  organizationId: string;
  propertyId: string;
  name: string;
  startDate: string;
  endDate: string;
  nightlyRate: number;
  minNights?: number;
};
