import { createServiceRoleClientLoose } from '@/lib/supabase/server';
import { channelRepository } from '@/src/domains/channel/repositories/channel.repository';

// Public iCal export — no auth required, secured by unguessable token.
// Google Calendar, Airbnb multi-calendar, etc. can subscribe to this URL.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  // Find connection by export token
  const connection = await channelRepository.findByExportToken(token);
  if (!connection) {
    return new Response('Not found', { status: 404 });
  }

  const db = createServiceRoleClientLoose();

  // Fetch active reservations for this property
  const { data: reservations } = await db
    .from('reservations')
    .select('id, check_in, check_out, guest_name, channel, platform_booking_id, status')
    .eq('property_id', connection.propertyId)
    .is('deleted_at', null)
    .not('status', 'in', '(cancelled,no_show)')
    .order('check_in');

  const { data: property } = await db
    .from('properties')
    .select('name')
    .eq('id', connection.propertyId)
    .single();

  const propertyName = (property as { name?: string } | null)?.name ?? 'Property';
  const now = toICalDate(new Date().toISOString());

  const events = (reservations ?? []).map(r => {
    const row = r as {
      id: string;
      check_in: string;
      check_out: string;
      guest_name: string | null;
      channel: string;
      platform_booking_id: string | null;
      status: string;
    };
    const uid = `${row.id}@airaroots`;
    const summary = row.guest_name ? `${row.guest_name} (${row.channel})` : `Reservation (${row.channel})`;
    return [
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTART;VALUE=DATE:${toDateOnly(row.check_in)}`,
      `DTEND;VALUE=DATE:${toDateOnly(row.check_out)}`,
      `SUMMARY:${escapeICalText(summary)}`,
      `STATUS:CONFIRMED`,
      `DTSTAMP:${now}`,
      'END:VEVENT',
    ].join('\r\n');
  });

  const cal = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Airaroots//EN',
    `X-WR-CALNAME:${escapeICalText(propertyName)}`,
    'X-WR-TIMEZONE:Asia/Kolkata',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...events,
    'END:VCALENDAR',
  ].join('\r\n');

  return new Response(cal, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${propertyName.replace(/[^a-z0-9]/gi, '-')}.ics"`,
      'Cache-Control': 'no-cache, no-store',
    },
  });
}

function toDateOnly(dateStr: string): string {
  return dateStr.slice(0, 10).replace(/-/g, '');
}

function toICalDate(isoStr: string): string {
  return isoStr.replace(/[-:.]/g, '').slice(0, 15) + 'Z';
}

function escapeICalText(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}
