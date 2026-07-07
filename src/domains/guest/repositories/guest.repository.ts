import type { SupabaseClient } from '@supabase/supabase-js';
import type { Guest, CreateGuestInput } from '../types';

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
