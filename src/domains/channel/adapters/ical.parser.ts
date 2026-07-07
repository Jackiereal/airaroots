import type { ICalEvent } from '../types';

// Minimal RFC 5545 iCal parser — no external deps.
// Handles the subset that Airbnb and Booking.com actually emit.

function unfoldLines(raw: string): string[] {
  // RFC 5545: lines ending with CRLF+SPACE/TAB are folded continuations
  return raw
    .replace(/\r\n[ \t]/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\n[ \t]/g, '')
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean);
}

function parseDate(value: string): string {
  // DATE: 20261215 → 2026-12-15
  // DATETIME: 20261215T140000Z → 2026-12-15
  const stripped = value.replace(/TZID=[^:]+:/, '').replace(/VALUE=DATE:/, '');
  const dateOnly = stripped.replace(/T.*$/, '');
  if (dateOnly.length === 8) {
    return `${dateOnly.slice(0, 4)}-${dateOnly.slice(4, 6)}-${dateOnly.slice(6, 8)}`;
  }
  return stripped;
}

function extractValue(line: string): string {
  // DTSTART;VALUE=DATE:20261215 → 20261215
  const colonIdx = line.indexOf(':');
  return colonIdx >= 0 ? line.slice(colonIdx + 1).trim() : '';
}

function extractStatus(value: string): ICalEvent['status'] {
  const upper = value.toUpperCase();
  if (upper === 'CANCELLED' || upper === 'CANCELED') return 'cancelled';
  if (upper === 'TENTATIVE') return 'tentative';
  return 'confirmed';
}

export function parseICalFeed(raw: string): ICalEvent[] {
  const lines = unfoldLines(raw);
  const events: ICalEvent[] = [];

  let inEvent = false;
  let current: Partial<ICalEvent> & { uid?: string } = {};

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      inEvent = true;
      current = {};
      continue;
    }

    if (line === 'END:VEVENT') {
      inEvent = false;
      if (current.uid && current.dtstart && current.dtend) {
        events.push({
          uid: current.uid,
          summary: current.summary ?? null,
          dtstart: current.dtstart,
          dtend: current.dtend,
          status: current.status ?? 'confirmed',
          description: current.description ?? null,
        });
      }
      continue;
    }

    if (!inEvent) continue;

    const propName = line.split(/[:;]/)[0].toUpperCase();

    switch (propName) {
      case 'UID':
        current.uid = extractValue(line);
        break;
      case 'SUMMARY':
        current.summary = extractValue(line);
        break;
      case 'DTSTART':
        current.dtstart = parseDate(extractValue(line));
        break;
      case 'DTEND':
        current.dtend = parseDate(extractValue(line));
        break;
      case 'STATUS':
        current.status = extractStatus(extractValue(line));
        break;
      case 'DESCRIPTION':
        current.description = extractValue(line);
        break;
    }
  }

  return events;
}

// Airbnb iCal: SUMMARY is "Reserved" or guest name, DESCRIPTION has booking code
// Extract Airbnb confirmation code from DESCRIPTION
export function extractAirbnbBookingId(event: ICalEvent): string {
  if (event.description) {
    const match = event.description.match(/\bHM[A-Z0-9]{8,}\b|\b[A-Z0-9]{10,}\b/);
    if (match) return match[0];
  }
  return event.uid;
}

// Booking.com iCal: UID contains booking reference like "BOOKING-123456789"
export function extractBookingComId(event: ICalEvent): string {
  const match = event.uid.match(/\d{5,}/);
  if (match) return match[0];
  return event.uid;
}

// Returns true for blocked/unavailable events that are NOT guest reservations
export function isBlockedEvent(event: ICalEvent): boolean {
  const summary = (event.summary ?? '').toLowerCase();
  return (
    summary === 'blocked' ||
    summary === 'not available' ||
    summary === 'airbnb (not available)' ||
    summary === 'closed - not available'
  );
}
