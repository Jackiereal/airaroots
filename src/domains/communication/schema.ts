import { z } from 'zod';

// PATCH body for editing a template. trigger/channel are fixed per row
// (they define the unique key), so only the editable fields are accepted.
export const UpdateTemplateSchema = z.object({
  subject: z.string().max(200).nullable().optional(),
  body: z.string().min(1).max(2000).optional(),
  isActive: z.boolean().optional(),
});

export type UpdateTemplateInput = z.infer<typeof UpdateTemplateSchema>;
