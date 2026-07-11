import type { SupabaseClient } from '@supabase/supabase-js';
import { CalendarRepository } from '../repositories/calendar.repository';
import { NotFoundError, ConflictError } from '../../../shared/errors/domain-errors';
import type {
  CalendarBlock,
  SeasonalRate,
  CreateBlockInput,
  UpdateBlockInput,
  CreateSeasonalRateInput,
} from '../types';

export class CalendarService {
  private repository: CalendarRepository;

  constructor(private supabase: SupabaseClient) {
    this.repository = new CalendarRepository(supabase);
  }

  async createBlock(input: CreateBlockInput, actorId: string): Promise<CalendarBlock> {
    const overlapping = await this.repository.findAnyOverlap(input.propertyId, input.startDate, input.endDate);
    if (overlapping.length > 0) {
      throw new ConflictError(
        'Dates overlap with an existing reservation or block',
        overlapping.map((b) => ({
          id: b.id,
          startDate: b.startDate,
          endDate: b.endDate,
          blockType: b.blockType,
          reason: b.reason ?? null,
        }))
      );
    }
    return this.repository.createBlock(input, actorId);
  }

  async updateBlock(propertyId: string, id: string, input: UpdateBlockInput): Promise<CalendarBlock> {
    return this.repository.updateBlock(propertyId, id, input);
  }

  async deleteBlock(propertyId: string, id: string, _actorId: string): Promise<void> {
    return this.repository.deleteBlock(propertyId, id);
  }

  async getBlocksForProperty(propertyId: string, from: Date, to: Date): Promise<CalendarBlock[]> {
    return this.repository.findBlocksByProperty(propertyId, from, to);
  }

  async getBlocksForOrganization(orgId: string, from: Date, to: Date): Promise<CalendarBlock[]> {
    return this.repository.findBlocksByOrganization(orgId, from, to);
  }

  async getSeasonalRates(propertyId: string): Promise<SeasonalRate[]> {
    return this.repository.findSeasonalRates(propertyId);
  }

  async createSeasonalRate(input: CreateSeasonalRateInput): Promise<SeasonalRate> {
    return this.repository.createSeasonalRate(input);
  }

  async getRateForDate(propertyId: string, date: Date): Promise<number | null> {
    const seasonal = await this.repository.findActiveRateForDate(propertyId, date);
    return seasonal ? seasonal.nightlyRate : null;
  }
}
