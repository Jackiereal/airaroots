import type { SupabaseClient } from '@supabase/supabase-js';
import { CalendarRepository } from '../repositories/calendar.repository';
import { NotFoundError } from '../../../shared/errors/domain-errors';
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
    return this.repository.createBlock(input, actorId);
  }

  async updateBlock(id: string, input: UpdateBlockInput): Promise<CalendarBlock> {
    return this.repository.updateBlock(id, input);
  }

  async deleteBlock(id: string, _actorId: string): Promise<void> {
    return this.repository.deleteBlock(id);
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
