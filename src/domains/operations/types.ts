// ─── Housekeeping ────────────────────────────────────────────────────────────

export type HousekeepingTaskType = 'checkout_clean' | 'mid_stay' | 'inspection' | 'deep_clean';
export type HousekeepingTaskStatus = 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';
export type HousekeepingPriceType = 'standard' | 'deep_clean' | 'inspection' | 'mid_stay';

export type ChecklistItem = {
  item: string;
  category: string;
  completed: boolean;
  notes: string;
};

export type HousekeepingStaff = {
  id: string;
  organizationId: string;
  propertyId: string;
  name: string;
  phone: string | undefined;
  email: string | undefined;
  status: 'active' | 'inactive';
  userId: string | undefined;
  notes: string | undefined;
  createdAt: string;
  updatedAt: string;
};

export type HousekeepingTask = {
  id: string;
  organizationId: string;
  propertyId: string;
  reservationId: string | undefined;
  taskType: HousekeepingTaskType;
  status: HousekeepingTaskStatus;
  assignedTo: string | undefined;          // housekeeping_staff.id
  scheduledDate: string;                   // YYYY-MM-DD
  scheduledTime: string | undefined;       // HH:MM
  customPrice: number | undefined;
  priceType: HousekeepingPriceType;
  checklist: ChecklistItem[];
  notes: string | undefined;
  startedAt: string | undefined;
  completedAt: string | undefined;
  accessToken: string;                     // UUID — public token for /hk/[token]
  reminderSentAt: string | undefined;
  createdBy: string | undefined;
  createdAt: string;
  updatedAt: string;
  // Joined
  staff?: HousekeepingStaff;
};

export type HousekeepingPhoto = {
  id: string;
  taskId: string;
  url: string;
  caption: string | undefined;
  uploadedBy: string | undefined;
  createdAt: string;
};

export type CreateHousekeepingTaskInput = {
  organizationId: string;
  propertyId: string;
  reservationId?: string;
  taskType: HousekeepingTaskType;
  scheduledDate: string;
  scheduledTime?: string;
  customPrice?: number;
  priceType?: HousekeepingPriceType;
  checklist?: ChecklistItem[];
  notes?: string;
  assignedTo?: string;
  createdBy?: string;
  status?: HousekeepingTaskStatus;
};

export type UpdateHousekeepingTaskInput = Partial<
  Pick<
    CreateHousekeepingTaskInput,
    | 'scheduledDate'
    | 'scheduledTime'
    | 'customPrice'
    | 'priceType'
    | 'checklist'
    | 'notes'
  >
> & { assignedTo?: string | null; status?: HousekeepingTaskStatus };

export type CreateHousekeepingStaffInput = {
  organizationId: string;
  propertyId: string;
  name: string;
  phone?: string;
  email?: string;
  notes?: string;
};

export type UpdateHousekeepingStaffInput = Partial<
  Pick<CreateHousekeepingStaffInput, 'propertyId' | 'name' | 'phone' | 'email' | 'notes'> & {
    status: 'active' | 'inactive';
  }
>;

// ─── Maintenance ─────────────────────────────────────────────────────────────

export type MaintenanceCategory =
  | 'plumbing'
  | 'electrical'
  | 'appliance'
  | 'structural'
  | 'hvac'
  | 'pest'
  | 'furniture'
  | 'other';

export type MaintenancePriority = 'low' | 'medium' | 'high' | 'urgent';
export type MaintenanceStatus = 'reported' | 'assigned' | 'in_progress' | 'resolved' | 'closed';

export type MaintenanceRequest = {
  id: string;
  organizationId: string;
  propertyId: string;
  reservationId: string | undefined;
  housekeepingTaskId: string | undefined;
  title: string;
  description: string | undefined;
  category: MaintenanceCategory | undefined;
  priority: MaintenancePriority;
  status: MaintenanceStatus;
  reportedBy: string | undefined;
  assignedTo: string | undefined;
  vendorId: string | undefined;
  estimatedCost: number | undefined;
  actualCost: number | undefined;
  resolvedAt: string | undefined;
  accessToken: string;                     // UUID — public token for /maintenance/[token]
  createdAt: string;
  updatedAt: string;
  // Joined
  vendor?: Vendor;
};

export type MaintenancePhoto = {
  id: string;
  requestId: string;
  url: string;
  caption: string | undefined;
  takenBy: string | undefined;
  createdAt: string;
};

export type CreateMaintenanceRequestInput = {
  organizationId: string;
  propertyId: string;
  reservationId?: string;
  housekeepingTaskId?: string;
  title: string;
  description?: string;
  category?: MaintenanceCategory;
  priority?: MaintenancePriority;
  reportedBy?: string;
};

export type UpdateMaintenanceRequestInput = Partial<{
  title: string;
  description: string;
  category: MaintenanceCategory;
  priority: MaintenancePriority;
  status: MaintenanceStatus;
  assignedTo: string | null;
  vendorId: string | null;
  estimatedCost: number;
  actualCost: number;
}>;

// ─── Vendors ─────────────────────────────────────────────────────────────────

export type VendorCategory =
  | 'plumbing'
  | 'electrical'
  | 'cleaning'
  | 'carpentry'
  | 'hvac'
  | 'pest_control'
  | 'landscaping'
  | 'security'
  | 'other';

export type Vendor = {
  id: string;
  organizationId: string;
  propertyId: string | undefined;   // undefined = org-wide, serves all properties
  name: string;
  category: VendorCategory | undefined;
  phone: string | undefined;
  email: string | undefined;
  address: string | undefined;
  ratePerVisit: number | undefined;
  notes: string | undefined;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CreateVendorInput = {
  organizationId: string;
  propertyId?: string;
  name: string;
  category?: VendorCategory;
  phone?: string;
  email?: string;
  address?: string;
  ratePerVisit?: number;
  notes?: string;
};

export type UpdateVendorInput = Partial<
  Pick<CreateVendorInput, 'name' | 'category' | 'phone' | 'email' | 'address' | 'ratePerVisit' | 'notes'> & {
    isActive: boolean;
  }
> & { propertyId?: string | null };

// ─── Inventory ───────────────────────────────────────────────────────────────

export type InventoryCategory =
  | 'linen'
  | 'toiletry'
  | 'kitchen'
  | 'cleaning'
  | 'electronics'
  | 'furniture'
  | 'other';

export type InventoryTransactionType = 'restock' | 'used' | 'damaged' | 'audit';

export type InventoryItem = {
  id: string;
  organizationId: string;
  propertyId: string;
  name: string;
  category: InventoryCategory | undefined;
  unit: string;
  quantity: number;
  reorderLevel: number;
  costPerUnit: number | undefined;
  notes: string | undefined;
  isLowStock: boolean;                     // computed: quantity <= reorderLevel
  createdAt: string;
  updatedAt: string;
};

export type InventoryTransaction = {
  id: string;
  itemId: string;
  taskId: string | undefined;
  type: InventoryTransactionType;
  quantity: number;
  cost: number | undefined;
  notes: string | undefined;
  createdBy: string | undefined;
  createdAt: string;
};

export type CreateInventoryItemInput = {
  organizationId: string;
  propertyId: string;
  name: string;
  category?: InventoryCategory;
  unit?: string;
  quantity?: number;
  reorderLevel?: number;
  costPerUnit?: number;
  notes?: string;
};

export type UpdateInventoryItemInput = Partial<
  Pick<
    CreateInventoryItemInput,
    'name' | 'category' | 'unit' | 'reorderLevel' | 'costPerUnit' | 'notes'
  >
>;

export type LogInventoryTransactionInput = {
  itemId: string;
  taskId?: string;
  type: InventoryTransactionType;
  quantity: number;                        // positive for restock, negative for used/damaged
  cost?: number;                           // restock only
  notes?: string;
  createdBy?: string;
};

// ─── Alerts ──────────────────────────────────────────────────────────────────

export type OperationsAlert = {
  type:
    | 'task_overdue'
    | 'task_at_risk'           // next checkin within 2hrs, task not complete
    | 'task_reminder'          // morning-of reminder needed
    | 'maintenance_blocking'   // open urgent/high maintenance, reservation within 48hrs
    | 'low_stock';
  severity: 'warning' | 'critical';
  propertyId: string;
  propertyName: string;
  message: string;
  taskId?: string;
  requestId?: string;
  itemId?: string;
  nextCheckinAt?: string;
};
