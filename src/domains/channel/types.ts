import type { ReservationChannel } from '../reservation/types';

export type ChannelConnectionStatus = 'active' | 'paused' | 'error' | 'disconnected';
export type ChannelSyncStatus = 'pending' | 'running' | 'success' | 'failed' | 'partial';
export type BackgroundJobStatus = 'pending' | 'running' | 'done' | 'failed' | 'cancelled';

export type ChannelConnection = {
  id: string;
  organizationId: string;
  propertyId: string;
  channel: ReservationChannel;
  icalUrl: string | null;
  webhookSecret: string | null;
  status: ChannelConnectionStatus;
  lastSyncAt: string | null;
  lastError: string | null;
  exportToken: string;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ChannelSyncLog = {
  id: string;
  organizationId: string;
  connectionId: string;
  propertyId: string;
  channel: ReservationChannel;
  status: ChannelSyncStatus;
  triggeredBy: 'cron' | 'manual' | 'webhook';
  reservationsFound: number;
  reservationsCreated: number;
  reservationsUpdated: number;
  reservationsCancelled: number;
  conflictsDetected: number;
  errorMessage: string | null;
  rawResponseSize: number | null;
  startedAt: string;
  finishedAt: string | null;
};

export type SyncResult = {
  connectionId: string;
  propertyId: string;
  channel: ReservationChannel;
  status: ChannelSyncStatus;
  reservationsFound: number;
  reservationsCreated: number;
  reservationsUpdated: number;
  reservationsCancelled: number;
  conflictsDetected: number;
  errorMessage?: string;
};

// Parsed event from an iCal feed
export type ICalEvent = {
  uid: string;              // VEVENT UID — used as platformBookingId
  summary: string | null;   // Guest name or "BLOCKED"
  dtstart: string;          // YYYY-MM-DD (date) or ISO (datetime)
  dtend: string;            // YYYY-MM-DD (date) or ISO (datetime)
  status: 'confirmed' | 'tentative' | 'cancelled';
  description: string | null;
};

export type CreateChannelConnectionInput = {
  propertyId: string;
  channel: ReservationChannel;
  icalUrl?: string;
};

export type UpdateChannelConnectionInput = {
  icalUrl?: string;
  status?: ChannelConnectionStatus;
};
