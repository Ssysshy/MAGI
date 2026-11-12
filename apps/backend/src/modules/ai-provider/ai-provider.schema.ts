import { z } from 'zod';

export const saveAiProviderConfigSchema = z.object({
  provider: z.literal('deepseek'),
  baseUrl: z.literal('https://api.deepseek.com'),
  model: z.literal('deepseek-flash'),
  apiKey: z.string().trim().min(1).max(4000).optional(),
  enabled: z.boolean(),
});

export type SaveAiProviderConfigInput = z.infer<typeof saveAiProviderConfigSchema>;
