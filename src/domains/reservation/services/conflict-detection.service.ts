import type { SupabaseClient } from '@supabase/supabase-js';
import { ReservationRepository } from '../repositories/reservation.repository';
import type { ConflictResult } from '../types';

export class ConflictDetectionService {
  private repository: ReservationRepository;

  constructor(private supabase: SupabaseClient) {
    this.repository = new ReservationRepository(supabase);
  }

  async check(
    propertyId: string,
    checkIn: Date,
    checkOut: Date,
    excludeId?: string
  ): Promise<ConflictResult> {
    // Overlap: existing.check_in < new.check_out AND existing.check_out > new.check_in
    // Back-to-back (existing.check_out === new.check_in) is NOT a conflict
    const conflicting = await this.repository.findConflicts(propertyId, checkIn, checkOut, excludeId);

    return {
      hasConflict: conflicting.length > 0,
      conflicts: conflicting.map((r) => ({
        id: r.id,
        checkIn: r.checkIn,
        checkOut: r.checkOut,
        guestName: r.guestName ?? null,
        status: r.status,
      })),
    };
  }
}
