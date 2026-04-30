import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  API_KEY_ENCRYPTION_SECRET: z.string().min(32),
  SYSTEM_AI_PROVIDER: z.string().min(1),
  SYSTEM_AI_BASE_URL: z.string().url(),
  SYSTEM_AI_MODEL: z.string().min(1),
  SYSTEM_AI_API_KEY: z.string().min(1),
  FRONTEND_ORIGIN: z.string().url().default('http://localhost:3000'),
  PORT: z.coerce.number().default(3001),
});

export const env = envSchema.parse(process.env);
