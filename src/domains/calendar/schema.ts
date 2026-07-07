import { z } from 'zod';

const blockTypeEnum = z.enum(['owner_hold', 'maintenance', 'buffer', 'seasonal_close']);

export const CreateManualBlockSchema = z.object({
  startDate: z.string().date(),
  endDate: z.string().date(),
  blockType: blockTypeEnum,
  reason: z.string().max(500).optional(),
  isPublic: z.boolean().default(true),
}).refine(
  (d: { startDate: string; endDate: string }) => new Date(d.endDate) >= new Date(d.startDate),
  { message: 'End date must be on or after start date', path: ['endDate'] }
);

export const UpdateBlockSchema = z.object({
  startDate: z.string().date().optional(),
  endDate: z.string().date().optional(),
  reason: z.string().max(500).optional(),
  isPublic: z.boolean().optional(),
});

export const CreateSeasonalRateSchema = z.object({
  name: z.string().min(1).max(200),
  startDate: z.string().date(),
  endDate: z.string().date(),
  nightlyRate: z.number().positive(),
  minNights: z.number().int().min(1).default(1),
}).refine(
  (d: { startDate: string; endDate: string }) => new Date(d.endDate) >= new Date(d.startDate),
  { message: 'End date must be on or after start date', path: ['endDate'] }
);
