import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  HousekeepingTask,
  HousekeepingStaff,
  HousekeepingPhoto,
  HousekeepingTaskStatus,
  ChecklistItem,
  CreateHousekeepingTaskInput,
  UpdateHousekeepingTaskInput,
  CreateHousekeepingStaffInput,
  UpdateHousekeepingStaffInput,
} from '../types';

type TaskRow = {
  id: string;
  organization_id: string;
  property_id: string;
  reservation_id: string | null;
  task_type: string;
  status: string;
  assigned_to: string | null;
  scheduled_date: string;
  scheduled_time: string | null;
  custom_price: string | null;
  price_type: string;
  checklist: ChecklistItem[];
  notes: string | null;
  started_at: string | null;
  completed_at: string | null;
  access_token: string;
  reminder_sent_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type StaffRow = {
  id: string;
  organization_id: string;
  property_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  status: string;
  user_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type PhotoRow = {
  id: string;
  task_id: string;
  url: string;
  caption: string | null;
  uploaded_by: string | null;
  created_at: string;
};

export class HousekeepingRepository {
  constructor(private supabase: SupabaseClient) {}

  // ─── Tasks ────────────────────────────────────────────────────────────────

  async findTaskById(id: string): Promise<HousekeepingTask | null> {
    const { data, error } = await this.supabase
      .from('housekeeping_tasks')
      .select('*, staff:housekeeping_staff(id,property_id,name,phone,email,status)')
      .eq('id', id)
      .single();

    if (error) throw new Error(`DB error: ${error.message}`);
    if (!data) return null;
    return this.toTaskEntity(data as TaskRow & { staff: StaffRow | null });
  }

  async findTaskByToken(accessToken: string): Promise<HousekeepingTask | null> {
    const { data, error } = await this.supabase
      .from('housekeeping_tasks')
      .select('*, staff:housekeeping_staff(id,property_id,name,phone,email,status), property:properties(id,name,address)')
      .eq('access_token', accessToken)
      .single();

    if (error) throw new Error(`DB error: ${error.message}`);
    if (!data) return null;
    return this.toTaskEntity(data as TaskRow & { staff: StaffRow | null });
  }

  async findTasksByOrg(
    organizationId: string,
    opts: { date?: string; status?: HousekeepingTaskStatus; propertyId?: string } = {}
  ): Promise<HousekeepingTask[]> {
    let query = this.supabase
      .from('housekeeping_tasks')
      .select('*, staff:housekeeping_staff(id,property_id,name,phone,email,status)')
      .eq('organization_id', organizationId)
      .order('scheduled_date', { ascending: true })
      .order('scheduled_time', { ascending: true });

    if (opts.date) query = query.eq('scheduled_date', opts.date);
    if (opts.status) query = query.eq('status', opts.status);
    if (opts.propertyId) query = query.eq('property_id', opts.propertyId);

    const { data, error } = await query;
    if (error) throw new Error(`DB error: ${error.message}`);
    return (data ?? []).map((r) => this.toTaskEntity(r as TaskRow & { staff: StaffRow | null }));
  }

  async findTasksByProperty(propertyId: string, date?: string): Promise<HousekeepingTask[]> {
    let query = this.supabase
      .from('housekeeping_tasks')
      .select('*, staff:housekeeping_staff(id,property_id,name,phone,email,status)')
      .eq('property_id', propertyId)
      .order('scheduled_date', { ascending: false });

    if (date) query = query.eq('scheduled_date', date);

    const { data, error } = await query;
    if (error) throw new Error(`DB error: ${error.message}`);
    return (data ?? []).map((r) => this.toTaskEntity(r as TaskRow & { staff: StaffRow | null }));
  }

  async findTaskByReservation(reservationId: string): Promise<HousekeepingTask | null> {
    const { data, error } = await this.supabase
      .from('housekeeping_tasks')
      .select('*')
      .eq('reservation_id', reservationId)
      .not('status', 'in', '("completed","cancelled")')
      .maybeSingle();

    if (error) throw new Error(`DB error: ${error.message}`);
    if (!data) return null;
    return this.toTaskEntity(data as TaskRow & { staff: null });
  }

  // Tasks scheduled today that haven't had reminder sent yet
  async findTasksNeedingReminder(date: string): Promise<HousekeepingTask[]> {
    const { data, error } = await this.supabase
      .from('housekeeping_tasks')
      .select('*, staff:housekeeping_staff(id,property_id,name,phone,email,status)')
      .eq('scheduled_date', date)
      .not('status', 'in', '("completed","cancelled")')
      .is('reminder_sent_at', null);

    if (error) throw new Error(`DB error: ${error.message}`);
    return (data ?? []).map((r) => this.toTaskEntity(r as TaskRow & { staff: StaffRow | null }));
  }

  async createTask(input: CreateHousekeepingTaskInput): Promise<HousekeepingTask> {
    const { data, error } = await this.supabase
      .from('housekeeping_tasks')
      .insert({
        organization_id: input.organizationId,
        property_id: input.propertyId,
        reservation_id: input.reservationId ?? null,
        task_type: input.taskType,
        scheduled_date: input.scheduledDate,
        scheduled_time: input.scheduledTime ?? null,
        custom_price: input.customPrice ?? null,
        price_type: input.priceType ?? 'standard',
        checklist: input.checklist ?? [],
        notes: input.notes ?? null,
        assigned_to: input.assignedTo ?? null,
        created_by: input.createdBy ?? null,
        ...(input.status ? { status: input.status } : {}),
      })
      .select()
      .single();

    if (error) throw new Error(`DB error: ${error.message}`);
    return this.toTaskEntity(data as TaskRow & { staff: null });
  }

  async updateTask(id: string, input: UpdateHousekeepingTaskInput): Promise<HousekeepingTask> {
    const patch: Record<string, unknown> = {};
    if (input.scheduledDate !== undefined) patch['scheduled_date'] = input.scheduledDate;
    if (input.scheduledTime !== undefined) patch['scheduled_time'] = input.scheduledTime;
    if (input.customPrice !== undefined) patch['custom_price'] = input.customPrice;
    if (input.priceType !== undefined) patch['price_type'] = input.priceType;
    if (input.checklist !== undefined) patch['checklist'] = input.checklist;
    if (input.notes !== undefined) patch['notes'] = input.notes;
    if (input.assignedTo !== undefined) patch['assigned_to'] = input.assignedTo;
    if (input.status !== undefined) {
      patch['status'] = input.status;
      if (input.status === 'in_progress') patch['started_at'] = new Date().toISOString();
      if (input.status === 'completed') patch['completed_at'] = new Date().toISOString();
    }

    const { data, error } = await this.supabase
      .from('housekeeping_tasks')
      .update(patch)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(`DB error: ${error.message}`);
    return this.toTaskEntity(data as TaskRow & { staff: null });
  }

  async deleteTask(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('housekeeping_tasks')
      .delete()
      .eq('id', id);
    if (error) throw new Error(`DB error: ${error.message}`);
  }

  async markReminderSent(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('housekeeping_tasks')
      .update({ reminder_sent_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw new Error(`DB error: ${error.message}`);
  }

  // ─── Checklist Templates ──────────────────────────────────────────────────

  async findTemplate(propertyId: string): Promise<ChecklistItem[] | null> {
    const { data, error } = await this.supabase
      .from('housekeeping_checklist_templates')
      .select('items')
      .eq('property_id', propertyId)
      .maybeSingle();
    if (error) throw new Error(`DB error: ${error.message}`);
    return data ? (data.items as ChecklistItem[]) : null;
  }

  async upsertTemplate(propertyId: string, organizationId: string, items: ChecklistItem[]): Promise<void> {
    const { error } = await this.supabase
      .from('housekeeping_checklist_templates')
      .upsert(
        { property_id: propertyId, organization_id: organizationId, items, updated_at: new Date().toISOString() },
        { onConflict: 'property_id' }
      );
    if (error) throw new Error(`DB error: ${error.message}`);
  }

  async deleteTemplate(propertyId: string): Promise<void> {
    const { error } = await this.supabase
      .from('housekeeping_checklist_templates')
      .delete()
      .eq('property_id', propertyId);
    if (error) throw new Error(`DB error: ${error.message}`);
  }

  async addPhoto(taskId: string, url: string, caption?: string, uploadedBy?: string): Promise<HousekeepingPhoto> {
    const { data, error } = await this.supabase
      .from('housekeeping_photos')
      .insert({
        task_id: taskId,
        url,
        caption: caption ?? null,
        uploaded_by: uploadedBy ?? null,
      })
      .select()
      .single();

    if (error) throw new Error(`DB error: ${error.message}`);
    const row = data as PhotoRow;
    return {
      id: row.id,
      taskId: row.task_id,
      url: row.url,
      caption: row.caption ?? undefined,
      uploadedBy: row.uploaded_by ?? undefined,
      createdAt: row.created_at,
    };
  }

  async findPhotos(taskId: string): Promise<HousekeepingPhoto[]> {
    const { data, error } = await this.supabase
      .from('housekeeping_photos')
      .select('*')
      .eq('task_id', taskId)
      .order('created_at', { ascending: true });

    if (error) throw new Error(`DB error: ${error.message}`);
    return (data ?? []).map((r) => {
      const row = r as PhotoRow;
      return {
        id: row.id,
        taskId: row.task_id,
        url: row.url,
        caption: row.caption ?? undefined,
        uploadedBy: row.uploaded_by ?? undefined,
        createdAt: row.created_at,
      };
    });
  }

  // ─── Staff ────────────────────────────────────────────────────────────────

  async findStaffById(id: string): Promise<HousekeepingStaff | null> {
    const { data, error } = await this.supabase
      .from('housekeeping_staff')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw new Error(`DB error: ${error.message}`);
    if (!data) return null;
    return this.toStaffEntity(data as StaffRow);
  }

  async findStaffByOrg(
    organizationId: string,
    activeOnly = true,
    propertyId?: string
  ): Promise<HousekeepingStaff[]> {
    let query = this.supabase
      .from('housekeeping_staff')
      .select('*')
      .eq('organization_id', organizationId)
      .order('name', { ascending: true });

    if (activeOnly) query = query.eq('status', 'active');
    if (propertyId) query = query.eq('property_id', propertyId);

    const { data, error } = await query;
    if (error) throw new Error(`DB error: ${error.message}`);
    return (data ?? []).map((r) => this.toStaffEntity(r as StaffRow));
  }

  async createStaff(input: CreateHousekeepingStaffInput): Promise<HousekeepingStaff> {
    const { data, error } = await this.supabase
      .from('housekeeping_staff')
      .insert({
        organization_id: input.organizationId,
        property_id: input.propertyId,
        name: input.name,
        phone: input.phone ?? null,
        email: input.email ?? null,
        notes: input.notes ?? null,
      })
      .select()
      .single();

    if (error) throw new Error(`DB error: ${error.message}`);
    return this.toStaffEntity(data as StaffRow);
  }

  async updateStaff(id: string, input: UpdateHousekeepingStaffInput): Promise<HousekeepingStaff> {
    const patch: Record<string, unknown> = {};
    if (input.propertyId !== undefined) patch['property_id'] = input.propertyId;
    if (input.name !== undefined) patch['name'] = input.name;
    if (input.phone !== undefined) patch['phone'] = input.phone;
    if (input.email !== undefined) patch['email'] = input.email;
    if (input.notes !== undefined) patch['notes'] = input.notes;
    if (input.status !== undefined) patch['status'] = input.status;

    const { data, error } = await this.supabase
      .from('housekeeping_staff')
      .update(patch)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(`DB error: ${error.message}`);
    return this.toStaffEntity(data as StaffRow);
  }

  // ─── Mappers ──────────────────────────────────────────────────────────────

  private toTaskEntity(row: TaskRow & { staff?: StaffRow | null }): HousekeepingTask {
    return {
      id: row.id,
      organizationId: row.organization_id,
      propertyId: row.property_id,
      reservationId: row.reservation_id ?? undefined,
      taskType: row.task_type as HousekeepingTask['taskType'],
      status: row.status as HousekeepingTaskStatus,
      assignedTo: row.assigned_to ?? undefined,
      scheduledDate: row.scheduled_date,
      scheduledTime: row.scheduled_time ?? undefined,
      customPrice: row.custom_price ? Number(row.custom_price) : undefined,
      priceType: row.price_type as HousekeepingTask['priceType'],
      checklist: row.checklist ?? [],
      notes: row.notes ?? undefined,
      startedAt: row.started_at ?? undefined,
      completedAt: row.completed_at ?? undefined,
      accessToken: row.access_token,
      reminderSentAt: row.reminder_sent_at ?? undefined,
      createdBy: row.created_by ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      staff: row.staff ? this.toStaffEntity(row.staff) : undefined,
    };
  }

  private toStaffEntity(row: StaffRow): HousekeepingStaff {
    return {
      id: row.id,
      organizationId: row.organization_id,
      propertyId: row.property_id,
      name: row.name,
      phone: row.phone ?? undefined,
      email: row.email ?? undefined,
      status: row.status as 'active' | 'inactive',
      userId: row.user_id ?? undefined,
      notes: row.notes ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
