import type { SupabaseClient } from '@supabase/supabase-js';
import { GuestRepository } from '../repositories/guest.repository';
import type { Guest, GuestWithStays, CreateGuestInput, UpdateGuestInput } from '../types';

export class GuestService {
  private repository: GuestRepository;

  constructor(private supabase: SupabaseClient) {
    this.repository = new GuestRepository(supabase);
  }

  async findOrCreate(input: CreateGuestInput): Promise<Guest> {
    // Deduplicate: email first, then phone
    if (input.email) {
      const existing = await this.repository.findByEmail(input.organizationId, input.email);
      if (existing) return existing;
    }
    if (input.phone) {
      const existing = await this.repository.findByPhone(input.organizationId, input.phone);
      if (existing) return existing;
    }

    return this.repository.create(input);
  }

  async findById(id: string): Promise<Guest | null> {
    return this.repository.findById(id);
  }

  async findByIdWithStays(id: string): Promise<GuestWithStays | null> {
    const guest = await this.repository.findById(id);
    if (!guest) return null;
    const stayCount = await this.repository.countStays(id);
    return { ...guest, stayCount };
  }

  async update(id: string, input: UpdateGuestInput): Promise<Guest> {
    return this.repository.update(id, input);
  }
}
