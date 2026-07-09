import type { SupabaseClient } from '@supabase/supabase-js';
import { HousekeepingRepository } from '../repositories/housekeeping.repository';
import { NotFoundError } from '../../../shared/errors/domain-errors';
import { DEFAULT_CHECKLIST } from '../constants';
import type {
  HousekeepingTask,
  HousekeepingStaff,
  HousekeepingPhoto,
  ChecklistItem,
  CreateHousekeepingTaskInput,
  UpdateHousekeepingTaskInput,
  CreateHousekeepingStaffInput,
  UpdateHousekeepingStaffInput,
} from '../types';

export class HousekeepingService {
  private repo: HousekeepingRepository;

  constructor(private supabase: SupabaseClient) {
    this.repo = new HousekeepingRepository(supabase);
  }

  // ─── Tasks ────────────────────────────────────────────────────────────────

  async getTask(id: string): Promise<HousekeepingTask> {
    const task = await this.repo.findTaskById(id);
    if (!task) throw new NotFoundError('HousekeepingTask', id);
    return task;
  }

  async getTaskByToken(accessToken: string): Promise<HousekeepingTask> {
    const task = await this.repo.findTaskByToken(accessToken);
    if (!task) throw new NotFoundError('HousekeepingTask', accessToken);
    return task;
  }

  async listTasks(
    organizationId: string,
    opts: { date?: string; status?: HousekeepingTask['status']; propertyId?: string } = {}
  ): Promise<HousekeepingTask[]> {
    return this.repo.findTasksByOrg(organizationId, opts);
  }

  async createTask(input: CreateHousekeepingTaskInput): Promise<HousekeepingTask> {
    // Use property template if exists, else global default
    let checklist = input.checklist && input.checklist.length > 0 ? input.checklist : null;
    if (!checklist) {
      const template = await this.repo.findTemplate(input.propertyId);
      checklist = template ?? DEFAULT_CHECKLIST;
    }

    // Auto-set status to 'assigned' when staff is provided at creation time
    const status = input.assignedTo ? 'assigned' : 'pending';

    return this.repo.createTask({ ...input, checklist, status });
  }

  // ─── Checklist Templates ────────────────────────────────────────────────────

  async getTemplate(propertyId: string): Promise<ChecklistItem[]> {
    const template = await this.repo.findTemplate(propertyId);
    return template ?? DEFAULT_CHECKLIST;
  }

  async upsertTemplate(propertyId: string, organizationId: string, items: ChecklistItem[]): Promise<void> {
    await this.repo.upsertTemplate(propertyId, organizationId, items);
  }

  async resetTemplate(propertyId: string): Promise<void> {
    await this.repo.deleteTemplate(propertyId);
  }

  async updateTask(id: string, input: UpdateHousekeepingTaskInput): Promise<HousekeepingTask> {
    const existing = await this.repo.findTaskById(id);
    if (!existing) throw new NotFoundError('HousekeepingTask', id);
    return this.repo.updateTask(id, input);
  }

  async assignTask(id: string, staffId: string): Promise<HousekeepingTask> {
    const existing = await this.repo.findTaskById(id);
    if (!existing) throw new NotFoundError('HousekeepingTask', id);
    return this.repo.updateTask(id, { assignedTo: staffId, status: 'assigned' });
  }

  async unassignTask(id: string): Promise<HousekeepingTask> {
    const existing = await this.repo.findTaskById(id);
    if (!existing) throw new NotFoundError('HousekeepingTask', id);
    return this.repo.updateTask(id, { assignedTo: undefined, status: 'pending' });
  }

  async startTask(id: string): Promise<HousekeepingTask> {
    const existing = await this.repo.findTaskById(id);
    if (!existing) throw new NotFoundError('HousekeepingTask', id);
    return this.repo.updateTask(id, { status: 'in_progress' });
  }

  // Called from public token page — housekeeper submits completed checklist
  async completeTask(
    accessToken: string,
    completedChecklist: ChecklistItem[],
    notes?: string
  ): Promise<HousekeepingTask> {
    const task = await this.repo.findTaskByToken(accessToken);
    if (!task) throw new NotFoundError('HousekeepingTask', accessToken);

    const completed = await this.repo.updateTask(task.id, {
      checklist: completedChecklist,
      notes: notes ?? task.notes,
      status: 'completed',
    });

    // Auto-log expense if task has a price (skip if already logged)
    if (task.customPrice != null && task.customPrice > 0) {
      const { data: existing } = await this.supabase
        .from('property_finance_expenses')
        .select('id')
        .eq('housekeeping_task_id', task.id)
        .maybeSingle();

      if (!existing) {
        const periodMonth = task.scheduledDate.substring(0, 7) + '-01';
        await this.supabase.from('property_finance_expenses').insert({
          property_id: task.propertyId,
          period_month: periodMonth,
          expense_type: 'housekeeping',
          amount: task.customPrice,
          expense_date: task.scheduledDate,
          notes: `Housekeeping – ${task.taskType.replace(/_/g, ' ')}${task.staff ? ` (${task.staff.name})` : ''}`,
          housekeeping_task_id: task.id,
          created_by: task.createdBy ?? task.organizationId,
        });
      }
    }

    return completed;
  }

  async deleteTask(id: string): Promise<void> {
    const existing = await this.repo.findTaskById(id);
    if (!existing) throw new NotFoundError('HousekeepingTask', id);
    await this.repo.deleteTask(id);
  }

  async cancelTask(id: string): Promise<HousekeepingTask> {
    const existing = await this.repo.findTaskById(id);
    if (!existing) throw new NotFoundError('HousekeepingTask', id);
    return this.repo.updateTask(id, { status: 'cancelled' });
  }

  async cancelTaskByReservation(reservationId: string): Promise<void> {
    const task = await this.repo.findTaskByReservation(reservationId);
    if (!task) return;
    await this.repo.updateTask(task.id, { status: 'cancelled' });
  }

  async rescheduleTask(reservationId: string, newDate: string): Promise<HousekeepingTask | null> {
    const task = await this.repo.findTaskByReservation(reservationId);
    if (!task) return null;
    return this.repo.updateTask(task.id, { scheduledDate: newDate });
  }

  async addPhoto(
    accessToken: string,
    url: string,
    caption?: string,
    uploadedBy?: string
  ): Promise<HousekeepingPhoto> {
    const task = await this.repo.findTaskByToken(accessToken);
    if (!task) throw new NotFoundError('HousekeepingTask', accessToken);
    return this.repo.addPhoto(task.id, url, caption, uploadedBy);
  }

  async addPhotoById(taskId: string, url: string, caption?: string, uploadedBy?: string): Promise<HousekeepingPhoto> {
    return this.repo.addPhoto(taskId, url, caption, uploadedBy);
  }

  async getPhotos(taskId: string): Promise<HousekeepingPhoto[]> {
    return this.repo.findPhotos(taskId);
  }

  async getTasksNeedingReminder(organizationId: string, date: string): Promise<HousekeepingTask[]> {
    return this.repo.findTasksNeedingReminder(organizationId, date);
  }

  async markReminderSent(taskId: string): Promise<void> {
    return this.repo.markReminderSent(taskId);
  }

  // WhatsApp click-to-chat URL for a task
  buildWhatsAppUrl(task: HousekeepingTask, staff: HousekeepingStaff, baseUrl: string): string {
    if (!staff.phone) return '';
    const phone = staff.phone.replace(/\D/g, '');
    const taskUrl = `${baseUrl}/hk/${task.accessToken}`;
    const message = `Hi ${staff.name}, Property needs cleaning on ${task.scheduledDate}${task.scheduledTime ? ` by ${task.scheduledTime}` : ''}. Tap here for checklist: ${taskUrl}`;
    return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  }

  buildReminderWhatsAppUrl(task: HousekeepingTask, staff: HousekeepingStaff, baseUrl: string): string {
    if (!staff.phone) return '';
    const phone = staff.phone.replace(/\D/g, '');
    const taskUrl = `${baseUrl}/hk/${task.accessToken}`;
    const message = `Reminder: Property cleaning today${task.scheduledTime ? ` by ${task.scheduledTime}` : ''}. Checklist: ${taskUrl}`;
    return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  }

  // ─── Staff ────────────────────────────────────────────────────────────────

  async getStaff(id: string): Promise<HousekeepingStaff> {
    const staff = await this.repo.findStaffById(id);
    if (!staff) throw new NotFoundError('HousekeepingStaff', id);
    return staff;
  }

  async listStaff(organizationId: string, activeOnly = true, propertyId?: string): Promise<HousekeepingStaff[]> {
    return this.repo.findStaffByOrg(organizationId, activeOnly, propertyId);
  }

  async createStaff(
    organizationId: string,
    input: Omit<CreateHousekeepingStaffInput, 'organizationId'>
  ): Promise<HousekeepingStaff> {
    return this.repo.createStaff({ ...input, organizationId });
  }

  async updateStaff(id: string, input: UpdateHousekeepingStaffInput): Promise<HousekeepingStaff> {
    const existing = await this.repo.findStaffById(id);
    if (!existing) throw new NotFoundError('HousekeepingStaff', id);
    return this.repo.updateStaff(id, input);
  }
}
