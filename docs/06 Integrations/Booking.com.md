# Booking.com Integration

> Phase: 2
> Status: Not built

---

## Overview

Booking.com integration syncs reservations, availability, and rates. Booking.com uses the **OTA Connect API** (also called Channel Manager API) and requires partner certification.

---

## Integration Approach

Booking.com integration requires certification as a **Connectivity Partner**. This involves:
1. Applying at partner.booking.com
2. Passing connectivity tests
3. Getting listed in Booking.com's extranet as a connected system

**Interim approach:** iCal feed (like Airbnb) while awaiting certification.

---

## iCal Adapter (Phase 2, immediate)

```typescript
// src/domains/channel/adapters/booking-com-ical.adapter.ts

export class BookingComICalAdapter {
  async sync(connection: ChannelConnection): Promise<SyncResult> {
    const icalUrl = connection.credentials_encrypted?.ical_url;
    const events = await this.fetchAndParse(icalUrl);
    const result = { created: 0, updated: 0, cancelled: 0, conflicts: 0 };

    for (const event of events) {
      // Booking.com iCal format:
      // SUMMARY: Booking.com - #BOOKING_ID - GUEST_NAME
      const bookingId = this.extractBookingId(event.summary);
      const guestName = this.extractGuestName(event.summary);

      if (!bookingId) continue;

      await reservationService.processChannelReservation({
        channel: 'booking_com',
        platformBookingId: bookingId,
        propertyId: connection.property_id,
        checkIn: event.dtstart,
        checkOut: event.dtend,
        guestName,
      });
    }

    return result;
  }

  private extractBookingId(summary: string): string | null {
    // Format: "Booking.com - #1234567890 - John Doe"
    const match = summary.match(/#(\d+)/);
    return match?.[1] ?? null;
  }
}
```

---

## OTA Connect API (Phase 2+, post-certification)

Booking.com's OTA Connect API provides:
- Full reservation details via XML/JSON
- Push availability updates
- Push rate updates
- Real-time notifications (ARI pushes and pulls)

### Key API Endpoints

```
POST /ota/OTA_HotelAvailNotifRQ  — Push availability blocks
POST /ota/OTA_HotelRateAmountNotifRQ  — Push rate changes
GET  /ota/OTA_ReadRQ  — Pull reservations
POST /ota/OTA_HotelResNotifRQ  — Receive reservation webhook
```

### Reservation Mapping

```typescript
mapToReservation(bookingComReservation: BookingComReservation): ChannelReservationPayload {
  return {
    channel: 'booking_com',
    platformBookingId: bookingComReservation.ResGlobalInfo.HotelReservationIDs.HotelReservationID[0].ResID_Value,
    checkIn: new Date(bookingComReservation.RoomStays.RoomStay[0].TimeSpan.Start),
    checkOut: new Date(bookingComReservation.RoomStays.RoomStay[0].TimeSpan.End),
    guestName: [
      bookingComReservation.ResGuests.ResGuest[0].Profiles.ProfileInfo.Profile.Customer.PersonName.GivenName,
      bookingComReservation.ResGuests.ResGuest[0].Profiles.ProfileInfo.Profile.Customer.PersonName.Surname,
    ].join(' '),
    guestEmail: bookingComReservation.ResGuests.ResGuest[0].Profiles.ProfileInfo.Profile.Customer.Email,
    adults: bookingComReservation.RoomStays.RoomStay[0].GuestCounts.GuestCount[0].Count,
    grossRevenue: parseFloat(bookingComReservation.RoomStays.RoomStay[0].Total.AmountAfterTax),
    rawPayload: bookingComReservation,
  };
}
```

---

## Channel Adapter Pattern

Both Airbnb and Booking.com adapters implement the same interface:

```typescript
// src/domains/channel/adapters/base.adapter.ts

interface ChannelAdapter {
  // Pull reservations from channel
  syncReservations(connection: ChannelConnection): Promise<SyncResult>;

  // Push availability to channel
  pushAvailability(connection: ChannelConnection, blocks: CalendarBlock[]): Promise<void>;

  // Push rates to channel
  pushRates(connection: ChannelConnection, rates: RateUpdate[]): Promise<void>;

  // Map channel-specific payload to canonical reservation
  mapToReservation(payload: unknown): ChannelReservationPayload;

  // Verify webhook signature
  verifyWebhookSignature(rawBody: string, signature: string): boolean;
}
```

This means adding a new channel (VRBO, Expedia) only requires:
1. Implement `ChannelAdapter` for the new channel
2. Register in `ChannelAdapterFactory`
3. No changes to core reservation logic

---

## Conflict Resolution Between Channels

When Airbnb and Booking.com both send a reservation for the same dates:

```typescript
async processChannelReservation(payload: ChannelReservationPayload): Promise<Reservation> {
  const conflicts = await conflictDetection.check(
    payload.propertyId,
    payload.checkIn,
    payload.checkOut
  );

  if (conflicts.hasConflict) {
    // Create reservation with conflict status
    const reservation = await reservationRepo.create({
      ...mapPayload(payload),
      status: 'conflict',
    });

    // Emit conflict event — notifies manager
    await eventBus.publish({
      eventType: 'reservation.conflict_detected',
      payload: {
        newReservation: reservation,
        conflictingReservations: conflicts.conflicts,
      },
    });

    return reservation;
  }

  // No conflict — create normally
  return reservationRepo.create({ ...mapPayload(payload), status: 'confirmed' });
}
```

---

## Rate Parity Management

When rates change in Airaroots, push to all connected channels:

```typescript
async pushRatesToAllChannels(propertyId: string, rateUpdates: RateUpdate[]): Promise<void> {
  const connections = await channelConnectionRepo.getActiveForProperty(propertyId);

  for (const connection of connections) {
    if (!connection.rate_push_enabled) continue;

    const adapter = ChannelAdapterFactory.create(connection.channel, connection);
    await enqueueJob('channel.push_rates', {
      connectionId: connection.id,
      rateUpdates,
    });
  }
}
```
