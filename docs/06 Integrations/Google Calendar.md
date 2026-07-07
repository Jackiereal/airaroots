# Google Calendar Integration

> Phase: 2
> Purpose: Export property availability to Google Calendar / import blocks

---

## Overview

Google Calendar integration enables property owners and managers to:
1. See their property calendar in their existing Google Calendar
2. Optionally sync Google Calendar blocks back to Airaroots (e.g., "I'm visiting my property Oct 10–15")

---

## Export: iCal Feed to Google Calendar

Each property gets a read-only iCal URL:

```
https://app.airaroots.com/api/properties/{propertyId}/calendar.ics?token={ical_token}
```

Users paste this URL into Google Calendar → "Other Calendars → From URL".

Events include:
- All confirmed reservations (guest name, check-in/out)
- Owner holds and maintenance blocks
- Blocked dates

```typescript
// app/api/properties/[propertyId]/calendar.ics/route.ts

export async function GET(
  request: NextRequest,
  { params }: { params: { propertyId: string } }
): Promise<NextResponse> {
  const token = request.nextUrl.searchParams.get('token');

  // Validate iCal token (no auth required — token is the secret)
  const property = await propertyRepo.findByIdAndICalToken(params.propertyId, token);
  if (!property) {
    return new NextResponse('Invalid token', { status: 401 });
  }

  const blocks = await calendarService.getBlocksForProperty(
    params.propertyId,
    subMonths(new Date(), 1),   // 1 month past
    addMonths(new Date(), 12)   // 12 months future
  );

  const icsContent = generateICS(property, blocks);

  return new NextResponse(icsContent, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${property.slug}.ics"`,
    },
  });
}

function generateICS(property: Property, blocks: CalendarBlock[]): string {
  const events = blocks.map(block => `
BEGIN:VEVENT
UID:${block.id}@airaroots.com
DTSTART;VALUE=DATE:${format(new Date(block.start_date), 'yyyyMMdd')}
DTEND;VALUE=DATE:${format(new Date(block.end_date), 'yyyyMMdd')}
SUMMARY:${getEventSummary(block)}
DESCRIPTION:${getEventDescription(block)}
END:VEVENT`).join('\n');

  return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Airaroots//Property Calendar//EN
X-WR-CALNAME:${property.name}
X-WR-TIMEZONE:Asia/Kolkata
${events}
END:VCALENDAR`;
}
```

---

## iCal Token Management

```sql
-- Add to properties table
ALTER TABLE properties ADD COLUMN IF NOT EXISTS ical_token text DEFAULT encode(gen_random_bytes(16), 'hex');
CREATE UNIQUE INDEX IF NOT EXISTS idx_properties_ical_token ON properties(ical_token);
```

Endpoint to regenerate token (invalidates existing Google Calendar subscriptions):
```
POST /api/properties/:id/ical-token/regenerate
```

---

## Import: Google Calendar → Airaroots (Phase 3)

Optional feature: users can connect their Google Calendar and blocks on it auto-sync to Airaroots as owner_hold blocks.

Requires: Google OAuth, `https://www.googleapis.com/auth/calendar.readonly` scope.

Polling every 30 minutes for changes to the connected Google Calendar.
