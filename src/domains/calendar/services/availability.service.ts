import type { SupabaseClient } from '@supabase/supabase-js';
import { CalendarRepository } from '../repositories/calendar.repository';
import type { AvailabilityResult } from '../types';

export class AvailabilityService {
  private repository: CalendarRepository;

  constructor(private supabase: SupabaseClient) {
    this.repository = new CalendarRepository(supabase);
  }

  async checkAvailability(
    propertyId: string,
    checkIn: Date,
    checkOut: Date
  ): Promise<AvailabilityResult> {
    const blocks = await this.repository.findConflictingBlocks(propertyId, checkIn, checkOut);
    return {
      available: blocks.length === 0,
      blockedBy: blocks,
    };
  }

  async getAvailableNights(propertyId: string, month: Date): Promise<string[]> {
    // Get all blocks for the property in the given month
    const startOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
    const endOfMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0);

    const blocks = await this.repository.findBlocksByProperty(propertyId, startOfMonth, endOfMonth);

    // Build a set of blocked dates
    const blocked = new Set<string>();
    for (const block of blocks) {
      const start = new Date(block.startDate);
      const end = new Date(block.endDate);
      const current = new Date(start);
      while (current <= end) {
        blocked.add(current.toISOString().split('T')[0] as string);
        current.setDate(current.getDate() + 1);
      }
    }

    // Return all dates in the month that are not blocked
    const available: string[] = [];
    const current = new Date(startOfMonth);
    while (current <= endOfMonth) {
      const dateStr = current.toISOString().split('T')[0] as string;
      if (!blocked.has(dateStr)) {
        available.push(dateStr);
      }
      current.setDate(current.getDate() + 1);
    }

    return available;
  }
}
