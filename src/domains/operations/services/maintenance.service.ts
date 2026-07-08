import type { SupabaseClient } from '@supabase/supabase-js';
import { MaintenanceRepository } from '../repositories/maintenance.repository';
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

  constructor(private supabase: SupabaseClient) {
    this.repo = new MaintenanceRepository(supabase);
  }

  async get(id: string): Promise<MaintenanceRequest> {
    const request = await this.repo.findById(id);
    if (!request) throw new NotFoundError('MaintenanceRequest', id);
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
    input: CreateMaintenanceRequestInput,
    reportedBy?: string
  ): Promise<MaintenanceRequest> {
    return this.repo.create({ ...input, organizationId }, reportedBy);
  }

  async update(id: string, input: UpdateMaintenanceRequestInput): Promise<MaintenanceRequest> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundError('MaintenanceRequest', id);
    return this.repo.update(id, input);
  }

  async assign(id: string, opts: { assignedTo?: string; vendorId?: string }): Promise<MaintenanceRequest> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundError('MaintenanceRequest', id);
    return this.repo.update(id, {
      ...opts,
      status: 'assigned',
    });
  }

  async updateStatus(id: string, status: MaintenanceStatus): Promise<MaintenanceRequest> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundError('MaintenanceRequest', id);
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

  async close(id: string): Promise<MaintenanceRequest> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundError('MaintenanceRequest', id);
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
