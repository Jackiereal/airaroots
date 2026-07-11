import type { SupabaseClient } from '@supabase/supabase-js';
import { ReservationRepository } from '../repositories/reservation.repository';
import { CalendarRepository } from '../../calendar/repositories/calendar.repository';
import type { ConflictResult } from '../types';

export class ConflictDetectionService {
  private repository: ReservationRepository;
  private calendarRepository: CalendarRepository;

  constructor(private supabase: SupabaseClient) {
    this.repository = new ReservationRepository(supabase);
    this.calendarRepository = new CalendarRepository(supabase);
  }

  async check(
    propertyId: string,
    checkIn: Date,
    checkOut: Date,
    excludeId?: string
  ): Promise<ConflictResult> {
    // Overlap: existing.check_in < new.check_out AND existing.check_out > new.check_in
    // Back-to-back (existing.check_out === new.check_in) is NOT a conflict
    const [conflicting, holds] = await Promise.all([
      this.repository.findConflicts(propertyId, checkIn, checkOut, excludeId),
      this.calendarRepository.findOverlappingHolds(propertyId, checkIn, checkOut),
    ]);

    return {
      hasConflict: conflicting.length > 0 || holds.length > 0,
      conflicts: [
        ...conflicting.map((r) => ({
          id: r.id,
          checkIn: r.checkIn,
          checkOut: r.checkOut,
          guestName: r.guestName ?? null,
          status: r.status,
        })),
        ...holds.map((h) => ({
          id: h.id,
          checkIn: h.startDate,
          checkOut: h.endDate,
          guestName: h.reason ? `Blocked: ${h.reason}` : `Blocked (${h.blockType})`,
          status: 'confirmed' as const,
        })),
      ],
    };
  }
}
