import type { SupabaseClient } from '@supabase/supabase-js';
import { MaintenanceRepository } from '../repositories/maintenance.repository';
import { VendorRepository } from '../repositories/vendor.repository';
import { NotFoundError } from '../../../shared/errors/domain-errors';
import type {
  MaintenanceRequest,
  MaintenancePhoto,
  Vendor,
  CreateMaintenanceRequestInput,
  UpdateMaintenanceRequestInput,
  MaintenanceStatus,
  MaintenancePriority,
} from '../types';

export class MaintenanceService {
  private repo: MaintenanceRepository;
  private vendorRepo: VendorRepository;

  constructor(private supabase: SupabaseClient) {
    this.repo = new MaintenanceRepository(supabase);
    this.vendorRepo = new VendorRepository(supabase);
  }

  async get(id: string, organizationId: string): Promise<MaintenanceRequest> {
    const request = await this.repo.findById(id);
    if (!request || request.organizationId !== organizationId) {
      throw new NotFoundError('MaintenanceRequest', id);
    }
    return request;
  }

  async getByToken(accessToken: string): Promise<MaintenanceRequest> {
    const request = await this.repo.findByToken(accessToken);
    if (!request) throw new NotFoundError('MaintenanceRequest', accessToken);
    return request;
  }

  async list(
    organizationId: string,
    opts: {
      status?: MaintenanceStatus;
      priority?: MaintenancePriority;
      propertyId?: string;
      openOnly?: boolean;
    } = {}
  ): Promise<MaintenanceRequest[]> {
    return this.repo.findByOrg(organizationId, opts);
  }

  async create(
    organizationId: string,
    input: Omit<CreateMaintenanceRequestInput, 'organizationId'>,
    reportedBy?: string
  ): Promise<MaintenanceRequest> {
    return this.repo.create({ ...input, organizationId }, reportedBy);
  }

  async update(organizationId: string, id: string, input: UpdateMaintenanceRequestInput): Promise<MaintenanceRequest> {
    const existing = await this.repo.findById(id);
    if (!existing || existing.organizationId !== organizationId) throw new NotFoundError('MaintenanceRequest', id);
    return this.repo.update(id, input);
  }

  async assign(organizationId: string, id: string, opts: { assignedTo?: string; vendorId?: string }): Promise<MaintenanceRequest> {
    const existing = await this.repo.findById(id);
    if (!existing || existing.organizationId !== organizationId) throw new NotFoundError('MaintenanceRequest', id);

    if (opts.vendorId) {
      const vendor = await this.vendorRepo.findById(opts.vendorId);
      if (!vendor || vendor.organizationId !== existing.organizationId) {
        throw new NotFoundError('Vendor', opts.vendorId);
      }
    }

    return this.repo.update(id, {
      ...opts,
      status: 'assigned',
    });
  }

  async updateStatus(organizationId: string, id: string, status: MaintenanceStatus): Promise<MaintenanceRequest> {
    const existing = await this.repo.findById(id);
    if (!existing || existing.organizationId !== organizationId) throw new NotFoundError('MaintenanceRequest', id);
    return this.repo.update(id, { status });
  }

  // Called from public token page — vendor marks resolved
  async resolveByToken(accessToken: string, actualCost?: number): Promise<MaintenanceRequest> {
    const request = await this.repo.findByToken(accessToken);
    if (!request) throw new NotFoundError('MaintenanceRequest', accessToken);
    return this.repo.update(request.id, {
      status: 'resolved',
      ...(actualCost !== undefined ? { actualCost } : {}),
    });
  }

  async delete(organizationId: string, id: string): Promise<void> {
    const existing = await this.repo.findById(id);
    if (!existing || existing.organizationId !== organizationId) throw new NotFoundError('MaintenanceRequest', id);
    await this.repo.delete(id);
  }

  async close(organizationId: string, id: string): Promise<MaintenanceRequest> {
    const existing = await this.repo.findById(id);
    if (!existing || existing.organizationId !== organizationId) throw new NotFoundError('MaintenanceRequest', id);
    return this.repo.update(id, { status: 'closed' });
  }

  async addPhoto(
    accessToken: string,
    url: string,
    caption?: string,
    takenBy?: string
  ): Promise<MaintenancePhoto> {
    const request = await this.repo.findByToken(accessToken);
    if (!request) throw new NotFoundError('MaintenanceRequest', accessToken);
    return this.repo.addPhoto(request.id, url, caption, takenBy);
  }

  async addPhotoById(requestId: string, url: string, caption?: string, takenBy?: string): Promise<MaintenancePhoto> {
    return this.repo.addPhoto(requestId, url, caption, takenBy);
  }

  async getPhotos(requestId: string): Promise<MaintenancePhoto[]> {
    return this.repo.findPhotos(requestId);
  }

  async getUrgentByProperty(propertyId: string): Promise<MaintenanceRequest[]> {
    return this.repo.findUrgentByProperty(propertyId);
  }

  // WhatsApp click-to-chat URL for vendor notification
  buildVendorWhatsAppUrl(request: MaintenanceRequest, vendor: Vendor, baseUrl: string): string {
    if (!vendor.phone) return '';
    const phone = vendor.phone.replace(/\D/g, '');
    const requestUrl = `${baseUrl}/maintenance/${request.accessToken}`;
    const message = `Hi ${vendor.name}, there's a ${request.priority} priority ${request.category ?? 'maintenance'} issue. Title: ${request.title}. Tap here for details: ${requestUrl}`;
    return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  }
}
