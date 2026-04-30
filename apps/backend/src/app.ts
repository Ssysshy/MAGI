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

  // 注册顺序保持为：跨域/基础中间件 -> 数据库 -> 鉴权 -> 业务路由。
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

  // health 不依赖登录，供容器和本地联调用。
  app.get('/health', async (): Promise<{ ok: true }> => ({ ok: true }));

  return app;
};
