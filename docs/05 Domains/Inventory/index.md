# Inventory Domain

> Phase: 4
> Status: Not built

---

## Overview

Inventory tracks consumable and capital items per property. When a housekeeping task is completed, staff can log items used. Managers get alerts when items fall below reorder level.

---

## Entities

### InventoryItem

| Field | Type | Description |
|-------|------|-------------|
| id | uuid | |
| organization_id | uuid | |
| property_id | uuid | |
| name | text | "Toilet paper rolls", "Shampoo bottles" |
| category | text | linen, toiletry, kitchen, cleaning, electronics, furniture |
| unit | text | unit, roll, bottle, set |
| quantity | int | Current stock |
| reorder_level | int | Alert when quantity falls below this |
| cost_per_unit | decimal? | For cost tracking |
| notes | text? | |

### InventoryTransaction

| Field | Type | Description |
|-------|------|-------------|
| id | uuid | |
| item_id | uuid | |
| type | enum | restock, used, damaged, audit |
| quantity | int | Positive for restock, negative for used/damaged |
| cost | decimal? | Cost of restock |
| notes | text? | |
| created_by | uuid | |

---

## Reorder Alert Logic

```typescript
// After inventory transaction:
if (item.quantity <= item.reorder_level) {
  await notificationService.send({
    type: 'inventory_reorder',
    title: `Low stock: ${item.name} at ${property.name}`,
    body: `Current: ${item.quantity} ${item.unit}. Reorder level: ${item.reorder_level}`,
    recipients: [propertyManagers],
  });
}
```

---

## API Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/properties/:id/inventory | List inventory items |
| POST | /api/properties/:id/inventory | Add item |
| PATCH | /api/properties/:id/inventory/:itemId | Update item |
| POST | /api/properties/:id/inventory/:itemId/transactions | Log transaction |
| GET | /api/inventory/low-stock | All items below reorder level |
