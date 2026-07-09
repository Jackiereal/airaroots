import type { SupabaseClient } from '@supabase/supabase-js';
import type { Vendor, VendorCategory, CreateVendorInput, UpdateVendorInput } from '../types';

type VendorRow = {
  id: string;
  organization_id: string;
  property_id: string | null;
  name: string;
  category: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  rate_per_visit: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export class VendorRepository {
  constructor(private supabase: SupabaseClient) {}

  async findById(id: string): Promise<Vendor | null> {
    const { data, error } = await this.supabase
      .from('vendors')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw new Error(`DB error: ${error.message}`);
    if (!data) return null;
    return this.toEntity(data as VendorRow);
  }

  async findByOrg(
    organizationId: string,
    opts: { activeOnly?: boolean; category?: VendorCategory; propertyId?: string } = {}
  ): Promise<Vendor[]> {
    let query = this.supabase
      .from('vendors')
      .select('*')
      .eq('organization_id', organizationId)
      .order('name', { ascending: true });

    if (opts.activeOnly !== false) query = query.eq('is_active', true);
    if (opts.category) query = query.eq('category', opts.category);
    // Org-wide vendors (property_id null) always included alongside property-specific ones
    if (opts.propertyId) query = query.or(`property_id.eq.${opts.propertyId},property_id.is.null`);

    const { data, error } = await query;
    if (error) throw new Error(`DB error: ${error.message}`);
    return (data ?? []).map((r) => this.toEntity(r as VendorRow));
  }

  async create(input: CreateVendorInput): Promise<Vendor> {
    const { data, error } = await this.supabase
      .from('vendors')
      .insert({
        organization_id: input.organizationId,
        property_id: input.propertyId ?? null,
        name: input.name,
        category: input.category ?? null,
        phone: input.phone ?? null,
        email: input.email ?? null,
        address: input.address ?? null,
        rate_per_visit: input.ratePerVisit ?? null,
        notes: input.notes ?? null,
      })
      .select()
      .single();

    if (error) throw new Error(`DB error: ${error.message}`);
    return this.toEntity(data as VendorRow);
  }

  async update(id: string, input: UpdateVendorInput): Promise<Vendor> {
    const patch: Record<string, unknown> = {};
    if (input.propertyId !== undefined) patch['property_id'] = input.propertyId;
    if (input.name !== undefined) patch['name'] = input.name;
    if (input.category !== undefined) patch['category'] = input.category;
    if (input.phone !== undefined) patch['phone'] = input.phone;
    if (input.email !== undefined) patch['email'] = input.email;
    if (input.address !== undefined) patch['address'] = input.address;
    if (input.ratePerVisit !== undefined) patch['rate_per_visit'] = input.ratePerVisit;
    if (input.notes !== undefined) patch['notes'] = input.notes;
    if (input.isActive !== undefined) patch['is_active'] = input.isActive;

    const { data, error } = await this.supabase
      .from('vendors')
      .update(patch)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(`DB error: ${error.message}`);
    return this.toEntity(data as VendorRow);
  }

  private toEntity(row: VendorRow): Vendor {
    return {
      id: row.id,
      organizationId: row.organization_id,
      propertyId: row.property_id ?? undefined,
      name: row.name,
      category: row.category as VendorCategory | undefined,
      phone: row.phone ?? undefined,
      email: row.email ?? undefined,
      address: row.address ?? undefined,
      ratePerVisit: row.rate_per_visit ? Number(row.rate_per_visit) : undefined,
      notes: row.notes ?? undefined,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
