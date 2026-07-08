import { z } from 'zod';

// ─── Housekeeping ─────────────────────────────────────────────────────────────

const taskTypeEnum = z.enum(['checkout_clean', 'mid_stay', 'inspection', 'deep_clean']);
const taskStatusEnum = z.enum(['pending', 'assigned', 'in_progress', 'completed', 'cancelled']);
const priceTypeEnum = z.enum(['standard', 'deep_clean', 'inspection', 'mid_stay']);

export const ChecklistItemSchema = z.object({
  item: z.string().min(1).max(200),
  category: z.string().max(50).default('general'),
  completed: z.boolean().default(false),
  notes: z.string().max(500).default(''),
});

export const CreateHousekeepingTaskSchema = z.object({
  propertyId: z.string().uuid(),
  reservationId: z.string().uuid().optional(),
  taskType: taskTypeEnum,
  scheduledDate: z.string().date(),
  scheduledTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  customPrice: z.number().min(0).optional(),
  priceType: priceTypeEnum.default('standard'),
  checklist: z.array(ChecklistItemSchema).default([]),
  notes: z.string().max(2000).optional(),
  assignedTo: z.string().uuid().optional(),
});

export const UpdateHousekeepingTaskSchema = z.object({
  scheduledDate: z.string().date().optional(),
  scheduledTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  customPrice: z.number().min(0).optional(),
  priceType: priceTypeEnum.optional(),
  checklist: z.array(ChecklistItemSchema).optional(),
  notes: z.string().max(2000).optional(),
  assignedTo: z.string().uuid().nullable().optional(),
  status: taskStatusEnum.optional(),
});

export const CreateHousekeepingStaffSchema = z.object({
  name: z.string().min(1).max(100),
  phone: z.string().max(20).optional(),
  email: z.string().email().optional(),
  notes: z.string().max(500).optional(),
});

export const UpdateHousekeepingStaffSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  phone: z.string().max(20).optional(),
  email: z.string().email().optional(),
  notes: z.string().max(500).optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

// Public token page — housekeeper submits completed task
export const CompleteTaskSchema = z.object({
  checklist: z.array(ChecklistItemSchema),
  notes: z.string().max(2000).optional(),
  // Inventory usage logged alongside completion
  inventoryUsed: z.array(z.object({
    itemId: z.string().uuid(),
    quantity: z.number().int().min(1),
  })).optional(),
});

// ─── Maintenance ──────────────────────────────────────────────────────────────

const maintenanceCategoryEnum = z.enum([
  'plumbing', 'electrical', 'appliance', 'structural', 'hvac', 'pest', 'furniture', 'other',
]);
const maintenancePriorityEnum = z.enum(['low', 'medium', 'high', 'urgent']);
const maintenanceStatusEnum = z.enum(['reported', 'assigned', 'in_progress', 'resolved', 'closed']);

export const CreateMaintenanceRequestSchema = z.object({
  propertyId: z.string().uuid(),
  reservationId: z.string().uuid().optional(),
  housekeepingTaskId: z.string().uuid().optional(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  category: maintenanceCategoryEnum.optional(),
  priority: maintenancePriorityEnum.default('medium'),
});

export const UpdateMaintenanceRequestSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  category: maintenanceCategoryEnum.optional(),
  priority: maintenancePriorityEnum.optional(),
  status: maintenanceStatusEnum.optional(),
  assignedTo: z.string().uuid().nullable().optional(),
  vendorId: z.string().uuid().nullable().optional(),
  estimatedCost: z.number().min(0).optional(),
  actualCost: z.number().min(0).optional(),
});

// Public token page — vendor marks resolved
export const ResolveMaintenanceSchema = z.object({
  notes: z.string().max(2000).optional(),
});

// ─── Vendors ──────────────────────────────────────────────────────────────────

const vendorCategoryEnum = z.enum([
  'plumbing', 'electrical', 'cleaning', 'carpentry', 'hvac', 'pest_control', 'landscaping', 'security', 'other',
]);

export const CreateVendorSchema = z.object({
  name: z.string().min(1).max(100),
  category: vendorCategoryEnum.optional(),
  phone: z.string().max(20).optional(),
  email: z.string().email().optional(),
  address: z.string().max(300).optional(),
  ratePerVisit: z.number().min(0).optional(),
  notes: z.string().max(500).optional(),
});

export const UpdateVendorSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  category: vendorCategoryEnum.optional(),
  phone: z.string().max(20).optional(),
  email: z.string().email().optional(),
  address: z.string().max(300).optional(),
  ratePerVisit: z.number().min(0).optional(),
  notes: z.string().max(500).optional(),
  isActive: z.boolean().optional(),
});

// ─── Inventory ────────────────────────────────────────────────────────────────

const inventoryCategoryEnum = z.enum([
  'linen', 'toiletry', 'kitchen', 'cleaning', 'electronics', 'furniture', 'other',
]);

const transactionTypeEnum = z.enum(['restock', 'used', 'damaged', 'audit']);

export const CreateInventoryItemSchema = z.object({
  propertyId: z.string().uuid(),
  name: z.string().min(1).max(100),
  category: inventoryCategoryEnum.optional(),
  unit: z.string().max(20).default('unit'),
  quantity: z.number().int().min(0).default(0),
  reorderLevel: z.number().int().min(0).default(0),
  costPerUnit: z.number().min(0).optional(),
  notes: z.string().max(500).optional(),
});

export const UpdateInventoryItemSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  category: inventoryCategoryEnum.optional(),
  unit: z.string().max(20).optional(),
  reorderLevel: z.number().int().min(0).optional(),
  costPerUnit: z.number().min(0).optional(),
  notes: z.string().max(500).optional(),
});

export const LogTransactionSchema = z.object({
  type: transactionTypeEnum,
  quantity: z.number().int().min(1),
  cost: z.number().min(0).optional(),
  notes: z.string().max(500).optional(),
});
