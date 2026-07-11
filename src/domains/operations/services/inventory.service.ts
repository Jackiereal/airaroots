import type { SupabaseClient } from '@supabase/supabase-js';
import { InventoryRepository } from '../repositories/inventory.repository';
import { NotFoundError } from '../../../shared/errors/domain-errors';
import type {
  InventoryItem,
  InventoryTransaction,
  InventoryCategory,
  CreateInventoryItemInput,
  UpdateInventoryItemInput,
  LogInventoryTransactionInput,
} from '../types';

export class InventoryService {
  private repo: InventoryRepository;

  constructor(private supabase: SupabaseClient) {
    this.repo = new InventoryRepository(supabase);
  }

  async get(id: string): Promise<InventoryItem> {
    const item = await this.repo.findById(id);
    if (!item) throw new NotFoundError('InventoryItem', id);
    return item;
  }

  async listByProperty(propertyId: string, category?: InventoryCategory): Promise<InventoryItem[]> {
    return this.repo.findByProperty(propertyId, category);
  }

  async getLowStock(organizationId: string): Promise<InventoryItem[]> {
    return this.repo.findLowStockByOrg(organizationId);
  }

  async create(organizationId: string, input: Omit<CreateInventoryItemInput, 'organizationId'>): Promise<InventoryItem> {
    return this.repo.create({ ...input, organizationId });
  }

  async update(propertyId: string, id: string, input: UpdateInventoryItemInput): Promise<InventoryItem> {
    const existing = await this.repo.findById(id);
    if (!existing || existing.propertyId !== propertyId) throw new NotFoundError('InventoryItem', id);
    return this.repo.update(id, input);
  }

  async logTransaction(propertyId: string, input: LogInventoryTransactionInput): Promise<{
    transaction: InventoryTransaction;
    item: InventoryItem;
    isLowStock: boolean;
  }> {
    const existing = await this.repo.findById(input.itemId);
    if (!existing || existing.propertyId !== propertyId) throw new NotFoundError('InventoryItem', input.itemId);

    const transaction = await this.repo.logTransaction(input);

    // Re-fetch to get updated quantity
    const updated = await this.repo.findById(input.itemId);
    const item = updated!;

    return {
      transaction,
      item,
      isLowStock: item.isLowStock,
    };
  }

  async getTransactions(itemId: string): Promise<InventoryTransaction[]> {
    return this.repo.findTransactions(itemId);
  }

  // Log multiple items used during a housekeeping task
  async logTaskUsage(
    propertyId: string,
    taskId: string,
    usedItems: Array<{ itemId: string; quantity: number }>,
    createdBy?: string
  ): Promise<Array<{ item: InventoryItem; isLowStock: boolean }>> {
    const results: Array<{ item: InventoryItem; isLowStock: boolean }> = [];

    for (const usage of usedItems) {
      const { item, isLowStock } = await this.logTransaction(propertyId, {
        itemId: usage.itemId,
        taskId,
        type: 'used',
        quantity: usage.quantity,
        createdBy,
      });
      results.push({ item, isLowStock });
    }

    return results;
  }
}
