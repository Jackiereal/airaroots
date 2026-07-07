import {
  parseICalFeed,
  extractAirbnbBookingId,
  extractBookingComId,
  isBlockedEvent,
} from '../adapters/ical.parser';
import { channelRepository } from '../repositories/channel.repository';
import { ReservationRepository } from '../../reservation/repositories/reservation.repository';
import { ConflictDetectionService } from '../../reservation/services/conflict-detection.service';
import { ensureHandlers } from '../../../infrastructure/events/ensure-handlers';
import { eventBus } from '../../../infrastructure/events/event-bus';
import { createServiceRoleClientLoose } from '../../../infrastructure/supabase/server';
import type { ChannelConnection, SyncResult, ICalEvent } from '../types';
import type { ReservationChannel } from '../../reservation/types';

const FETCH_TIMEOUT_MS = 15_000;

async function fetchICalFeed(url: string): Promise<{ text: string; size: number }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching iCal`);
    const text = await res.text();
    return { text, size: Buffer.byteLength(text, 'utf8') };
  } finally {
    clearTimeout(timer);
  }
}

function extractPlatformBookingId(event: ICalEvent, channel: ReservationChannel): string {
  if (channel === 'airbnb') return extractAirbnbBookingId(event);
  if (channel === 'booking_com') return extractBookingComId(event);
  return event.uid;
}

// Normalize iCal dtend: Airbnb/Booking.com use exclusive end date for all-day events
// (check_out = dtend, which is already the departure day)
function normalizeCheckOut(dtend: string): string {
  return dtend; // already correct for date-only events
}

async function syncConnection(
  connection: ChannelConnection,
  triggeredBy: 'cron' | 'manual' | 'webhook',
): Promise<SyncResult> {
  const result: SyncResult = {
    connectionId: connection.id,
    propertyId: connection.propertyId,
    channel: connection.channel,
    status: 'success',
    reservationsFound: 0,
    reservationsCreated: 0,
    reservationsUpdated: 0,
    reservationsCancelled: 0,
    conflictsDetected: 0,
  };

  if (!connection.icalUrl) {
    result.status = 'failed';
    result.errorMessage = 'No iCal URL configured';
    return result;
  }

  const logId = await channelRepository.createSyncLog({
    organizationId: connection.organizationId,
    connectionId: connection.id,
    propertyId: connection.propertyId,
    channel: connection.channel,
    triggeredBy,
  });

  let rawSize: number | undefined;

  try {
    const { text, size } = await fetchICalFeed(connection.icalUrl);
    rawSize = size;

    const events = parseICalFeed(text);
    result.reservationsFound = events.length;

    await ensureHandlers();

    const db = createServiceRoleClientLoose();
    const reservationRepo = new ReservationRepository(db);
    const conflictSvc = new ConflictDetectionService(db);

    for (const event of events) {
      if (event.status === 'cancelled') {
        const platformBookingId = extractPlatformBookingId(event, connection.channel);
        const existing = await reservationRepo.findByPlatformBookingId(
          connection.organizationId,
          platformBookingId,
        );
        if (existing && existing.status !== 'cancelled') {
          await reservationRepo.updateStatus(existing.id, 'cancelled');
          await eventBus.publish({
            eventId: crypto.randomUUID(),
            eventType: 'reservation.cancelled',
            aggregateId: existing.id,
            aggregateType: 'reservation',
            organizationId: connection.organizationId,
            occurredAt: new Date().toISOString(),
            version: 1,
            payload: { reservation: existing as unknown as Record<string, unknown> },
          });
          result.reservationsCancelled++;
        }
        continue;
      }

      if (isBlockedEvent(event)) {
        continue;
      }

      const platformBookingId = extractPlatformBookingId(event, connection.channel);
      const checkIn = event.dtstart;
      const checkOut = normalizeCheckOut(event.dtend);
      const guestName = event.summary ?? null;

      const existing = await reservationRepo.findByPlatformBookingId(
        connection.organizationId,
        platformBookingId,
      );

      if (existing) {
        const datesChanged =
          existing.checkIn !== checkIn || existing.checkOut !== checkOut;
        if (datesChanged) {
          const conflicts = await conflictSvc.check(
            connection.propertyId,
            new Date(checkIn),
            new Date(checkOut),
            existing.id,
          );
          if (conflicts.hasConflict) {
            await reservationRepo.updateStatus(existing.id, 'conflict');
            result.conflictsDetected++;
            await eventBus.publish({
              eventId: crypto.randomUUID(),
              eventType: 'reservation.conflict_detected',
              aggregateId: existing.id,
              aggregateType: 'reservation',
              organizationId: connection.organizationId,
              occurredAt: new Date().toISOString(),
              version: 1,
              payload: {
                reservation: existing as unknown as Record<string, unknown>,
                conflictingIds: conflicts.conflicts as unknown as Record<string, unknown>,
              },
            });
          } else {
            await reservationRepo.update(existing.id, { checkIn, checkOut });
            result.reservationsUpdated++;
          }
        }
        continue;
      }

      const conflicts = await conflictSvc.check(
        connection.propertyId,
        new Date(checkIn),
        new Date(checkOut),
      );

      if (conflicts.hasConflict) result.conflictsDetected++;

      const created = await reservationRepo.create({
        organizationId: connection.organizationId,
        propertyId: connection.propertyId,
        channel: connection.channel,
        platformBookingId,
        checkIn,
        checkOut,
        adults: 1,
        children: 0,
        pets: 0,
        nightlyRate: 0,
        cleaningFee: 0,
        taxes: 0,
        otherFees: 0,
        platformCommission: 0,
        guestName: guestName ?? undefined,
      });

      result.reservationsCreated++;

      if (conflicts.hasConflict) {
        await reservationRepo.updateStatus(created.id, 'conflict');
        await eventBus.publish({
          eventId: crypto.randomUUID(),
          eventType: 'reservation.conflict_detected',
          aggregateId: created.id,
          aggregateType: 'reservation',
          organizationId: connection.organizationId,
          occurredAt: new Date().toISOString(),
          version: 1,
          payload: {
            reservation: created as unknown as Record<string, unknown>,
            conflictingIds: conflicts.conflicts as unknown as Record<string, unknown>,
          },
        });
      } else {
        await eventBus.publish({
          eventId: crypto.randomUUID(),
          eventType: 'reservation.created',
          aggregateId: created.id,
          aggregateType: 'reservation',
          organizationId: connection.organizationId,
          occurredAt: new Date().toISOString(),
          version: 1,
          payload: { reservation: created as unknown as Record<string, unknown> },
        });
      }
    }

    result.status = result.conflictsDetected > 0 ? 'partial' : 'success';

    await channelRepository.updateSyncLog(logId, {
      ...result,
      rawResponseSize: rawSize,
    });

    await channelRepository.markSyncResult(connection.id, 'active', null);
  } catch (err) {
    result.status = 'failed';
    result.errorMessage = err instanceof Error ? err.message : String(err);

    await channelRepository.updateSyncLog(logId, {
      status: 'failed',
      errorMessage: result.errorMessage,
      rawResponseSize: rawSize,
    });

    await channelRepository.markSyncResult(connection.id, 'error', result.errorMessage);
  }

  return result;
}

export const channelSyncService = {
  // Sync a specific connection (used for manual trigger + webhook)
  syncConnection,

  // Sync all active connections for an org
  async syncOrganization(organizationId: string, triggeredBy: 'cron' | 'manual'): Promise<SyncResult[]> {
    const connections = await channelRepository.findByOrganization(organizationId);
    const active = connections.filter(c => c.status === 'active' && c.icalUrl);
    return Promise.all(active.map(c => syncConnection(c, triggeredBy)));
  },

  // Sync ALL active connections across all orgs (cron entry point)
  async syncAll(triggeredBy: 'cron' | 'manual' = 'cron'): Promise<SyncResult[]> {
    const connections = await channelRepository.findActiveConnections();
    const results: SyncResult[] = [];
    // Sequential to avoid hammering Airbnb/Booking.com servers
    for (const connection of connections) {
      results.push(await syncConnection(connection, triggeredBy));
    }
    return results;
  },
};
