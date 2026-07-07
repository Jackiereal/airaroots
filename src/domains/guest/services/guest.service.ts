import type { SupabaseClient } from '@supabase/supabase-js';
import { GuestRepository } from '../repositories/guest.repository';
import type { Guest, CreateGuestInput } from '../types';

export class GuestService {
  private repository: GuestRepository;

  constructor(private supabase: SupabaseClient) {
    this.repository = new GuestRepository(supabase);
  }

  async findOrCreate(input: CreateGuestInput): Promise<Guest> {
    // Deduplicate by email within organization
    if (input.email) {
      const existing = await this.repository.findByEmail(input.organizationId, input.email);
      if (existing) return existing;
    }

    return this.repository.create(input);
  }

  async findById(id: string): Promise<Guest | null> {
    return this.repository.findById(id);
  }
}
