# Airbnb Integration

> Phase: 2
> Status: Not built (CSV import exists as workaround)

---

## Overview

The Airbnb integration pulls reservation data from Airbnb via their API and pushes availability and rate changes. This replaces the current CSV import workaround with real-time, automated sync.

---

## Integration Approach

Airbnb provides two integration paths:
1. **iCal feed** — Simple calendar sync. Free, no approval required. Read-only.
2. **Airbnb API (via Software Provider Program)** — Full API access. Requires Airbnb review and approval.

**Phase 2 implementation: iCal-first, API when approved.**

### iCal Sync (Phase 2, immediate)
- Airbnb provides an iCal URL per listing
- We poll it every 15 minutes
- Extract blocked dates and reservation summaries
- Create reservations from iCal events

**Limitations:** No guest contact info in iCal. Limited financial data. No real-time.

### Airbnb API (Phase 2+, pending approval)
- Full reservation details including guest info, financial breakdown
- Webhook events for real-time updates
- Ability to push rates and availability back to Airbnb
- Requires Airbnb Software Provider Program membership

---

## iCal Adapter

```typescript
// src/domains/channel/adapters/airbnb-ical.adapter.ts

import ical from 'node-ical';

interface AirbnbICalEvent {
  uid: string;
  summary: string;   // "Airbnb (CONFIRMATION_CODE)" or "Not available" for blocks
  dtstart: Date;
  dtend: Date;
  description?: string;
  location?: string;
}

export class AirbnbICalAdapter {
  async sync(connection: ChannelConnection): Promise<SyncResult> {
    const icalUrl = connection.credentials_encrypted?.ical_url;
    if (!icalUrl) throw new Error('No iCal URL configured');

    const events = await this.fetchAndParse(icalUrl);
    const result = { created: 0, updated: 0, cancelled: 0, conflicts: 0 };

    for (const event of events) {
      try {
        await this.processEvent(event, connection, result);
      } catch (error) {
        logger.warn('Failed to process iCal event', { uid: event.uid, error });
      }
    }

    return result;
  }

  private async processEvent(
    event: AirbnbICalEvent,
    connection: ChannelConnection,
    result: SyncResult
  ): Promise<void> {
    const isReservation = event.summary.includes('(') && !event.summary.includes('Not available');

    if (!isReservation) {
      // Owner block or unavailability — create calendar block
      await this.processBlock(event, connection);
      return;
    }

    const confirmationCode = this.extractConfirmationCode(event.summary);
    if (!confirmationCode) return;

    await reservationService.processChannelReservation({
      channel: 'airbnb',
      platformBookingId: confirmationCode,
      propertyId: connection.property_id,
      checkIn: event.dtstart,
      checkOut: event.dtend,
      guestName: this.extractGuestName(event.description),
      // Note: financial data not available in iCal — will be null until API integration
    });
  }

  private extractConfirmationCode(summary: string): string | null {
    const match = summary.match(/\(([A-Z0-9]+)\)/);
    return match?.[1] ?? null;
  }
}
```

---

## Airbnb API Adapter (Phase 2+)

```typescript
// src/domains/channel/adapters/airbnb-api.adapter.ts

export class AirbnbAPIAdapter implements ChannelAdapter {
  private readonly baseUrl = 'https://api.airbnb.com/v2';

  constructor(private readonly accessToken: string) {}

  async getReservations(listingId: string, since?: Date): Promise<AirbnbReservation[]> {
    const response = await fetch(`${this.baseUrl}/reservations?listing_id=${listingId}`, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });
    const data = await response.json();
    return data.reservations;
  }

  async pushAvailability(listingId: string, blockedDates: Date[]): Promise<void> {
    // Airbnb uses "calendar" endpoint to block/open dates
    const body = {
      listing_id: listingId,
      calendar: blockedDates.map(date => ({
        date: format(date, 'yyyy-MM-dd'),
        available: false,
      })),
    };

    await fetch(`${this.baseUrl}/calendar_operations`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  }

  async pushRates(listingId: string, rates: { date: string; price: number }[]): Promise<void> {
    const body = {
      listing_id: listingId,
      calendar: rates.map(r => ({ date: r.date, price: r.price })),
    };

    await fetch(`${this.baseUrl}/calendar_operations`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  }

  // Map Airbnb API response to Airaroots canonical reservation
  mapToReservation(airbnbReservation: AirbnbAPIReservation): ChannelReservationPayload {
    return {
      channel: 'airbnb',
      platformBookingId: airbnbReservation.confirmation_code,
      platformListingId: airbnbReservation.listing_id,
      checkIn: new Date(airbnbReservation.start_date),
      checkOut: new Date(airbnbReservation.end_date),
      guestName: airbnbReservation.guest.first_name + ' ' + airbnbReservation.guest.last_name,
      guestEmail: airbnbReservation.guest.email,
      guestPhone: airbnbReservation.guest.phone,
      adults: airbnbReservation.guest_details.number_of_adults,
      children: airbnbReservation.guest_details.number_of_children,
      nightlyRate: airbnbReservation.listing_base_price_accurate,
      cleaningFee: airbnbReservation.cleaning_fee_accurate,
      grossRevenue: airbnbReservation.total_price_accurate,
      platformCommission: airbnbReservation.airbnb_host_fee_accurate,
      netPayout: airbnbReservation.expected_payout_amount_accurate,
      rawPayload: airbnbReservation,
    };
  }
}
```

---

## Webhook Processing

Airbnb sends webhooks for:
- `reservation.created` — New booking
- `reservation.modified` — Dates/guests changed
- `reservation.cancelled` — Cancellation

```typescript
// app/api/webhooks/airbnb/route.ts

export async function POST(request: NextRequest): Promise<NextResponse> {
  const rawBody = await request.text();
  const signature = request.headers.get('X-Airbnb-Signature') ?? '';

  const expectedSig = createHmac('sha256', process.env.AIRBNB_WEBHOOK_SECRET!)
    .update(rawBody)
    .digest('hex');

  if (signature !== `sha256=${expectedSig}`) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const payload = JSON.parse(rawBody);

  // Log raw webhook
  await supabase.from('channel_webhook_logs').insert({
    channel: 'airbnb',
    event_type: payload.event_type,
    raw_payload: payload,
    signature_valid: true,
  });

  // Queue for processing — do NOT process inline
  await enqueueJob('channel.process_webhook', {
    channel: 'airbnb',
    eventType: payload.event_type,
    payload,
  });

  return NextResponse.json({ received: true }); // Must respond quickly
}
```

---

## OAuth Connection Flow

```
1. User clicks "Connect Airbnb" in Settings → Channels
2. App redirects to: https://www.airbnb.com/oauth2/auth?
     client_id=AIRAROOTS_CLIENT_ID
     &redirect_uri=https://app.airaroots.com/api/channels/airbnb/callback
     &response_type=code
     &scope=reservations,calendar
3. User approves on Airbnb
4. Airbnb redirects to callback with code
5. App exchanges code for access_token + refresh_token
6. App encrypts tokens, stores in channel_connections.credentials_encrypted
7. App fetches listing ID from Airbnb API
8. channel_connections record created with status = 'connected'
9. Background job triggered: full sync of last 90 days
```

---

## Sync Schedule

| Sync Type | Frequency | Method |
|-----------|-----------|--------|
| iCal poll | Every 15 minutes | Cron job |
| Webhook | Real-time (Airbnb pushes) | Webhook handler |
| Manual refresh | On demand | User action |
| Full sync | On initial connection | One-time job |

---

## Error Handling

| Error | Response |
|-------|----------|
| Airbnb API rate limit | Retry with exponential backoff, log warning |
| Invalid token (expired) | Attempt token refresh, mark connection as error if fails |
| Webhook signature mismatch | Log, discard, alert admin |
| Duplicate reservation | Update existing record (idempotent) |
| Conflict with existing reservation | Set status = 'conflict', alert manager |
| iCal parse failure | Log error, skip problematic event, continue with rest |
