import type { ChecklistItem } from './types';

export const DEFAULT_CHECKLIST: ChecklistItem[] = [
  { item: 'Remove all guest items / lost & found check', category: 'general', completed: false, notes: '' },
  { item: 'Change all bed linens', category: 'bedroom', completed: false, notes: '' },
  { item: 'Replace towels (bath, hand, face)', category: 'bathroom', completed: false, notes: '' },
  { item: 'Clean and disinfect bathroom surfaces', category: 'bathroom', completed: false, notes: '' },
  { item: 'Clean toilet', category: 'bathroom', completed: false, notes: '' },
  { item: 'Restock toiletries (shampoo, soap, toilet paper)', category: 'bathroom', completed: false, notes: '' },
  { item: 'Mop bathroom floor', category: 'bathroom', completed: false, notes: '' },
  { item: 'Clean kitchen countertops', category: 'kitchen', completed: false, notes: '' },
  { item: 'Wash and dry dishes', category: 'kitchen', completed: false, notes: '' },
  { item: 'Clean stovetop and microwave', category: 'kitchen', completed: false, notes: '' },
  { item: 'Empty refrigerator of perishables', category: 'kitchen', completed: false, notes: '' },
  { item: 'Restock kitchen supplies (coffee, tea, sugar)', category: 'kitchen', completed: false, notes: '' },
  { item: 'Vacuum all carpeted areas', category: 'cleaning', completed: false, notes: '' },
  { item: 'Mop all hard floors', category: 'cleaning', completed: false, notes: '' },
  { item: 'Wipe down all surfaces and mirrors', category: 'cleaning', completed: false, notes: '' },
  { item: 'Empty all trash bins', category: 'cleaning', completed: false, notes: '' },
  { item: 'Check all appliances work (AC, TV, WiFi)', category: 'check', completed: false, notes: '' },
  { item: 'Lock all doors and windows', category: 'security', completed: false, notes: '' },
  { item: 'Take completion photos', category: 'documentation', completed: false, notes: '' },
];
