import type { SupabaseClient } from '@supabase/supabase-js';
import type { Guest, CreateGuestInput, UpdateGuestInput } from '../types';

type GuestRow = {
  id: string;
  organization_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  nationality: string | null;
  notes: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
};

export class GuestRepository {
  constructor(private supabase: SupabaseClient) {}

  async findById(id: string): Promise<Guest | null> {
    const { data, error } = await this.supabase
      .from('guests')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw new Error(`DB error: ${error.message}`);
    if (!data) return null;
    return this.toEntity(data as GuestRow);
  }

  async findByEmail(organizationId: string, email: string): Promise<Guest | null> {
    const { data, error } = await this.supabase
      .from('guests')
      .select('*')
      .eq('organization_id', organizationId)
      .ilike('email', email)
      .maybeSingle();

    if (error) throw new Error(`DB error: ${error.message}`);
    if (!data) return null;
    return this.toEntity(data as GuestRow);
  }

  async findByPhone(organizationId: string, phone: string): Promise<Guest | null> {
    const { data, error } = await this.supabase
      .from('guests')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('phone', phone)
      .maybeSingle();

    if (error) throw new Error(`DB error: ${error.message}`);
    if (!data) return null;
    return this.toEntity(data as GuestRow);
  }

  async update(id: string, input: UpdateGuestInput): Promise<Guest> {
    const patch: Record<string, unknown> = {};
    if (input.fullName !== undefined) patch['full_name'] = input.fullName;
    if (input.email !== undefined) patch['email'] = input.email;
    if (input.phone !== undefined) patch['phone'] = input.phone;
    if (input.nationality !== undefined) patch['nationality'] = input.nationality;
    if (input.notes !== undefined) patch['notes'] = input.notes;
    if (input.tags !== undefined) patch['tags'] = input.tags;

    const { data, error } = await this.supabase
      .from('guests')
      .update(patch)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(`DB error: ${error.message}`);
    return this.toEntity(data as GuestRow);
  }

  async countStays(guestId: string): Promise<number> {
    const { count, error } = await this.supabase
      .from('reservations')
      .select('id', { count: 'exact', head: true })
      .eq('guest_id', guestId)
      .is('deleted_at', null)
      .not('status', 'in', '("cancelled","no_show")');

    if (error) throw new Error(`DB error: ${error.message}`);
    return count ?? 0;
  }

  async create(input: CreateGuestInput): Promise<Guest> {
    const { data, error } = await this.supabase
      .from('guests')
      .insert({
        organization_id: input.organizationId,
        full_name: input.fullName,
        email: input.email ?? null,
        phone: input.phone ?? null,
        nationality: input.nationality ?? null,
        notes: input.notes ?? null,
        tags: input.tags ?? [],
      })
      .select()
      .single();

    if (error) throw new Error(`DB error: ${error.message}`);
    return this.toEntity(data as GuestRow);
  }

  private toEntity(row: GuestRow): Guest {
    return {
      id: row.id,
      organizationId: row.organization_id,
      fullName: row.full_name,
      email: row.email ?? undefined,
      phone: row.phone ?? undefined,
      nationality: row.nationality ?? undefined,
      notes: row.notes ?? undefined,
      tags: row.tags,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
