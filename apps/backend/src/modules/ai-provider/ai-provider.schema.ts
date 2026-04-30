import { z } from 'zod';

export const saveAiProviderConfigSchema = z.object({
  provider: z.string().trim().min(1).max(40),
  baseUrl: z.string().url(),
  model: z.string().trim().min(1).max(80),
  apiKey: z.string().trim().min(1).max(4000),
  enabled: z.boolean(),
});

export type SaveAiProviderConfigInput = z.infer<typeof saveAiProviderConfigSchema>;
