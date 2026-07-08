import type { SupabaseClient } from '@supabase/supabase-js';
import { VendorRepository } from '../repositories/vendor.repository';
import { NotFoundError } from '../../../shared/errors/domain-errors';
import type { Vendor, VendorCategory, CreateVendorInput, UpdateVendorInput } from '../types';

export class VendorService {
  private repo: VendorRepository;

  constructor(private supabase: SupabaseClient) {
    this.repo = new VendorRepository(supabase);
  }

  async get(id: string): Promise<Vendor> {
    const vendor = await this.repo.findById(id);
    if (!vendor) throw new NotFoundError('Vendor', id);
    return vendor;
  }

  async list(
    organizationId: string,
    opts: { activeOnly?: boolean; category?: VendorCategory } = {}
  ): Promise<Vendor[]> {
    return this.repo.findByOrg(organizationId, opts);
  }

  async create(organizationId: string, input: CreateVendorInput): Promise<Vendor> {
    return this.repo.create({ ...input, organizationId });
  }

  async update(id: string, input: UpdateVendorInput): Promise<Vendor> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundError('Vendor', id);
    return this.repo.update(id, input);
  }

  async deactivate(id: string): Promise<Vendor> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundError('Vendor', id);
    return this.repo.update(id, { isActive: false });
  }
}
