import { z } from 'zod';

export const createDecisionSessionSchema = z.object({
  question: z.string().trim().min(2).max(2000),
});

export type CreateDecisionSessionInput = z.infer<typeof createDecisionSessionSchema>;
