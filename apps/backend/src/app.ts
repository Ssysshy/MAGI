import Fastify, { type FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import prismaPlugin from './plugins/prisma.js';
import authPlugin from './plugins/auth.js';
import { env } from './config/env.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { userRoutes } from './modules/user/user.routes.js';
import { aiProviderRoutes } from './modules/ai-provider/ai-provider.routes.js';
import { decisionRoutes } from './modules/decision/decision.routes.js';

export const buildApp = async (): Promise<FastifyInstance> => {
  const app = Fastify({ logger: true });

  await app.register(cors, {
    origin: env.FRONTEND_ORIGIN,
    credentials: true,
  });
  await app.register(cookie, { secret: env.JWT_SECRET });
  await app.register(rateLimit, {
    max: 120,
    timeWindow: '1 minute',
  });
  await app.register(prismaPlugin);
  await app.register(authPlugin);
  await app.register(authRoutes);
  await app.register(userRoutes);
  await app.register(aiProviderRoutes);
  await app.register(decisionRoutes);

  app.get('/health', async (): Promise<{ ok: true }> => ({ ok: true }));

  return app;
};
