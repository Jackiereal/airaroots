import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  MaintenanceRequest,
  MaintenancePhoto,
  MaintenanceStatus,
  MaintenancePriority,
  Vendor,
  CreateMaintenanceRequestInput,
  UpdateMaintenanceRequestInput,
} from '../types';

type RequestRow = {
  id: string;
  organization_id: string;
  property_id: string;
  reservation_id: string | null;
  housekeeping_task_id: string | null;
  title: string;
  description: string | null;
  category: string | null;
  priority: string;
  status: string;
  reported_by: string | null;
  assigned_to: string | null;
  vendor_id: string | null;
  estimated_cost: string | null;
  actual_cost: string | null;
  resolved_at: string | null;
  access_token: string;
  created_at: string;
  updated_at: string;
};

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

type PhotoRow = {
  id: string;
  request_id: string;
  url: string;
  caption: string | null;
  taken_by: string | null;
  created_at: string;
};

export class MaintenanceRepository {
  constructor(private supabase: SupabaseClient) {}

  async findById(id: string): Promise<MaintenanceRequest | null> {
    const { data, error } = await this.supabase
      .from('maintenance_requests')
      .select('*, vendor:vendors(*)')
      .eq('id', id)
      .single();

    if (error) throw new Error(`DB error: ${error.message}`);
    if (!data) return null;
    return this.toEntity(data as RequestRow & { vendor: VendorRow | null });
  }

  async findByToken(accessToken: string): Promise<MaintenanceRequest | null> {
    const { data, error } = await this.supabase
      .from('maintenance_requests')
      .select('*, vendor:vendors(*), property:properties(id,name,address)')
      .eq('access_token', accessToken)
      .single();

    if (error) throw new Error(`DB error: ${error.message}`);
    if (!data) return null;
    return this.toEntity(data as RequestRow & { vendor: VendorRow | null });
  }

  async findByOrg(
    organizationId: string,
    opts: {
      status?: MaintenanceStatus;
      priority?: MaintenancePriority;
      propertyId?: string;
      openOnly?: boolean;
    } = {}
  ): Promise<MaintenanceRequest[]> {
    let query = this.supabase
      .from('maintenance_requests')
      .select('*, vendor:vendors(*)')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    if (opts.status) query = query.eq('status', opts.status);
    if (opts.priority) query = query.eq('priority', opts.priority);
    if (opts.propertyId) query = query.eq('property_id', opts.propertyId);
    if (opts.openOnly) query = query.not('status', 'in', '("resolved","closed")');

    const { data, error } = await query;
    if (error) throw new Error(`DB error: ${error.message}`);
    return (data ?? []).map((r) => this.toEntity(r as RequestRow & { vendor: VendorRow | null }));
  }

  // Open high/urgent requests at a property — for at-risk reservation alerts
  async findUrgentByProperty(propertyId: string): Promise<MaintenanceRequest[]> {
    const { data, error } = await this.supabase
      .from('maintenance_requests')
      .select('*')
      .eq('property_id', propertyId)
      .in('priority', ['high', 'urgent'])
      .not('status', 'in', '("resolved","closed")');

    if (error) throw new Error(`DB error: ${error.message}`);
    return (data ?? []).map((r) => this.toEntity(r as RequestRow & { vendor: null }));
  }

  async create(
    input: CreateMaintenanceRequestInput,
    reportedBy?: string
  ): Promise<MaintenanceRequest> {
    const { data, error } = await this.supabase
      .from('maintenance_requests')
      .insert({
        organization_id: input.organizationId,
        property_id: input.propertyId,
        reservation_id: input.reservationId ?? null,
        housekeeping_task_id: input.housekeepingTaskId ?? null,
        title: input.title,
        description: input.description ?? null,
        category: input.category ?? null,
        priority: input.priority ?? 'medium',
        reported_by: reportedBy ?? null,
      })
      .select()
      .single();

    if (error) throw new Error(`DB error: ${error.message}`);
    return this.toEntity(data as RequestRow & { vendor: null });
  }

  async update(id: string, input: UpdateMaintenanceRequestInput): Promise<MaintenanceRequest> {
    const patch: Record<string, unknown> = {};
    if (input.title !== undefined) patch['title'] = input.title;
    if (input.description !== undefined) patch['description'] = input.description;
    if (input.category !== undefined) patch['category'] = input.category;
    if (input.priority !== undefined) patch['priority'] = input.priority;
    if (input.status !== undefined) {
      patch['status'] = input.status;
      if (input.status === 'resolved') patch['resolved_at'] = new Date().toISOString();
    }
    if (input.assignedTo !== undefined) patch['assigned_to'] = input.assignedTo;
    if (input.vendorId !== undefined) patch['vendor_id'] = input.vendorId;
    if (input.estimatedCost !== undefined) patch['estimated_cost'] = input.estimatedCost;
    if (input.actualCost !== undefined) patch['actual_cost'] = input.actualCost;

    const { data, error } = await this.supabase
      .from('maintenance_requests')
      .update(patch)
      .eq('id', id)
      .select('*, vendor:vendors(*)')
      .single();

    if (error) throw new Error(`DB error: ${error.message}`);
    return this.toEntity(data as RequestRow & { vendor: VendorRow | null });
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('maintenance_requests')
      .delete()
      .eq('id', id);
    if (error) throw new Error(`DB error: ${error.message}`);
  }

  async addPhoto(requestId: string, url: string, caption?: string, takenBy?: string): Promise<MaintenancePhoto> {
    const { data, error } = await this.supabase
      .from('maintenance_photos')
      .insert({
        request_id: requestId,
        url,
        caption: caption ?? null,
        taken_by: takenBy ?? null,
      })
      .select()
      .single();

    if (error) throw new Error(`DB error: ${error.message}`);
    const row = data as PhotoRow;
    return {
      id: row.id,
      requestId: row.request_id,
      url: row.url,
      caption: row.caption ?? undefined,
      takenBy: row.taken_by ?? undefined,
      createdAt: row.created_at,
    };
  }

  async findPhotos(requestId: string): Promise<MaintenancePhoto[]> {
    const { data, error } = await this.supabase
      .from('maintenance_photos')
      .select('*')
      .eq('request_id', requestId)
      .order('created_at', { ascending: true });

    if (error) throw new Error(`DB error: ${error.message}`);
    return (data ?? []).map((r) => {
      const row = r as PhotoRow;
      return {
        id: row.id,
        requestId: row.request_id,
        url: row.url,
        caption: row.caption ?? undefined,
        takenBy: row.taken_by ?? undefined,
        createdAt: row.created_at,
      };
    });
  }

  private toEntity(row: RequestRow & { vendor?: VendorRow | null }): MaintenanceRequest {
    return {
      id: row.id,
      organizationId: row.organization_id,
      propertyId: row.property_id,
      reservationId: row.reservation_id ?? undefined,
      housekeepingTaskId: row.housekeeping_task_id ?? undefined,
      title: row.title,
      description: row.description ?? undefined,
      category: row.category as MaintenanceRequest['category'],
      priority: row.priority as MaintenancePriority,
      status: row.status as MaintenanceStatus,
      reportedBy: row.reported_by ?? undefined,
      assignedTo: row.assigned_to ?? undefined,
      vendorId: row.vendor_id ?? undefined,
      estimatedCost: row.estimated_cost ? Number(row.estimated_cost) : undefined,
      actualCost: row.actual_cost ? Number(row.actual_cost) : undefined,
      resolvedAt: row.resolved_at ?? undefined,
      accessToken: row.access_token,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      vendor: row.vendor ? this.toVendorEntity(row.vendor) : undefined,
    };
  }

  private toVendorEntity(row: VendorRow): Vendor {
    return {
      id: row.id,
      organizationId: row.organization_id,
      propertyId: row.property_id ?? undefined,
      name: row.name,
      category: row.category as Vendor['category'],
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
