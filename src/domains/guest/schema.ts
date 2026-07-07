import { z } from 'zod';

export const CreateGuestSchema = z.object({
  organizationId: z.string().uuid(),
  fullName: z.string().min(1).max(200),
  email: z.string().email().optional(),
  phone: z.string().max(30).optional(),
  nationality: z.string().max(100).optional(),
  notes: z.string().max(2000).optional(),
  tags: z.array(z.string()).optional(),
});

export type CreateGuestInput = z.infer<typeof CreateGuestSchema>;
