import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  InventoryItem,
  InventoryTransaction,
  InventoryCategory,
  CreateInventoryItemInput,
  UpdateInventoryItemInput,
  LogInventoryTransactionInput,
} from '../types';

type ItemRow = {
  id: string;
  organization_id: string;
  property_id: string;
  name: string;
  category: string | null;
  unit: string;
  quantity: number;
  reorder_level: number;
  cost_per_unit: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type TransactionRow = {
  id: string;
  item_id: string;
  task_id: string | null;
  type: string;
  quantity: number;
  cost: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
};

export class InventoryRepository {
  constructor(private supabase: SupabaseClient) {}

  async findById(id: string): Promise<InventoryItem | null> {
    const { data, error } = await this.supabase
      .from('inventory_items')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw new Error(`DB error: ${error.message}`);
    if (!data) return null;
    return this.toEntity(data as ItemRow);
  }

  async findByProperty(propertyId: string, category?: InventoryCategory): Promise<InventoryItem[]> {
    let query = this.supabase
      .from('inventory_items')
      .select('*')
      .eq('property_id', propertyId)
      .order('category', { ascending: true })
      .order('name', { ascending: true });

    if (category) query = query.eq('category', category);

    const { data, error } = await query;
    if (error) throw new Error(`DB error: ${error.message}`);
    return (data ?? []).map((r) => this.toEntity(r as ItemRow));
  }

  async findLowStockByOrg(organizationId: string): Promise<InventoryItem[]> {
    // quantity <= reorder_level, exclude items where reorder_level = 0 (untracked)
    const { data, error } = await this.supabase
      .from('inventory_items')
      .select('*')
      .eq('organization_id', organizationId)
      .gt('reorder_level', 0)
      .filter('quantity', 'lte', 'reorder_level')
      .order('property_id', { ascending: true })
      .order('name', { ascending: true });

    if (error) throw new Error(`DB error: ${error.message}`);
    return (data ?? []).map((r) => this.toEntity(r as ItemRow));
  }

  async create(input: CreateInventoryItemInput): Promise<InventoryItem> {
    const { data, error } = await this.supabase
      .from('inventory_items')
      .insert({
        organization_id: input.organizationId,
        property_id: input.propertyId,
        name: input.name,
        category: input.category ?? null,
        unit: input.unit ?? 'unit',
        quantity: input.quantity ?? 0,
        reorder_level: input.reorderLevel ?? 0,
        cost_per_unit: input.costPerUnit ?? null,
        notes: input.notes ?? null,
      })
      .select()
      .single();

    if (error) throw new Error(`DB error: ${error.message}`);
    return this.toEntity(data as ItemRow);
  }

  async update(id: string, input: UpdateInventoryItemInput): Promise<InventoryItem> {
    const patch: Record<string, unknown> = {};
    if (input.name !== undefined) patch['name'] = input.name;
    if (input.category !== undefined) patch['category'] = input.category;
    if (input.unit !== undefined) patch['unit'] = input.unit;
    if (input.reorderLevel !== undefined) patch['reorder_level'] = input.reorderLevel;
    if (input.costPerUnit !== undefined) patch['cost_per_unit'] = input.costPerUnit;
    if (input.notes !== undefined) patch['notes'] = input.notes;

    const { data, error } = await this.supabase
      .from('inventory_items')
      .update(patch)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(`DB error: ${error.message}`);
    return this.toEntity(data as ItemRow);
  }

  async logTransaction(input: LogInventoryTransactionInput): Promise<InventoryTransaction> {
    const { data, error } = await this.supabase
      .from('inventory_transactions')
      .insert({
        item_id: input.itemId,
        task_id: input.taskId ?? null,
        type: input.type,
        // restock = positive, used/damaged = stored as negative
        quantity: input.type === 'used' || input.type === 'damaged'
          ? -Math.abs(input.quantity)
          : Math.abs(input.quantity),
        cost: input.cost ?? null,
        notes: input.notes ?? null,
        created_by: input.createdBy ?? null,
      })
      .select()
      .single();

    if (error) throw new Error(`DB error: ${error.message}`);

    // Update item quantity
    await this.adjustQuantity(input.itemId, input.type, input.quantity);

    const row = data as TransactionRow;
    return this.toTransactionEntity(row);
  }

  private async adjustQuantity(
    itemId: string,
    type: LogInventoryTransactionInput['type'],
    quantity: number
  ): Promise<void> {
    const delta = type === 'used' || type === 'damaged' ? -Math.abs(quantity) : Math.abs(quantity);

    const { error } = await this.supabase.rpc('increment_inventory_quantity', {
      p_item_id: itemId,
      p_delta: delta,
    }).then(() => ({ error: null })).catch((e: Error) => ({ error: e }));

    // Fallback if RPC not available: manual read+write
    if (error) {
      const { data: item } = await this.supabase
        .from('inventory_items')
        .select('quantity')
        .eq('id', itemId)
        .single();

      if (item) {
        const newQty = Math.max(0, (item as ItemRow).quantity + delta);
        await this.supabase
          .from('inventory_items')
          .update({ quantity: newQty })
          .eq('id', itemId);
      }
    }
  }

  async findTransactions(itemId: string): Promise<InventoryTransaction[]> {
    const { data, error } = await this.supabase
      .from('inventory_transactions')
      .select('*')
      .eq('item_id', itemId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`DB error: ${error.message}`);
    return (data ?? []).map((r) => this.toTransactionEntity(r as TransactionRow));
  }

  private toEntity(row: ItemRow): InventoryItem {
    return {
      id: row.id,
      organizationId: row.organization_id,
      propertyId: row.property_id,
      name: row.name,
      category: row.category as InventoryCategory | undefined,
      unit: row.unit,
      quantity: row.quantity,
      reorderLevel: row.reorder_level,
      costPerUnit: row.cost_per_unit ? Number(row.cost_per_unit) : undefined,
      notes: row.notes ?? undefined,
      isLowStock: row.reorder_level > 0 && row.quantity <= row.reorder_level,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private toTransactionEntity(row: TransactionRow): InventoryTransaction {
    return {
      id: row.id,
      itemId: row.item_id,
      taskId: row.task_id ?? undefined,
      type: row.type as InventoryTransaction['type'],
      quantity: row.quantity,
      cost: row.cost ? Number(row.cost) : undefined,
      notes: row.notes ?? undefined,
      createdBy: row.created_by ?? undefined,
      createdAt: row.created_at,
    };
  }
}
