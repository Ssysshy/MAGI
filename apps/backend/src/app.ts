import Fastify, { type FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { ZodError } from 'zod';
import prismaPlugin from './plugins/prisma.js';
import authPlugin from './plugins/auth.js';
import { env } from './config/env.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { userRoutes } from './modules/user/user.routes.js';
import { aiProviderRoutes } from './modules/ai-provider/ai-provider.routes.js';
import { decisionRoutes } from './modules/decision/decision.routes.js';

export const buildApp = async (): Promise<FastifyInstance> => {
  const app = Fastify({ logger: true });

  app.setErrorHandler((error, _request, reply): void => {
    const appError = error as Error & { statusCode?: number };

    if (appError instanceof ZodError) {
      reply.status(400).send({ error: 'VALIDATION_ERROR' });
      return;
    }

    const statusCode = appError.statusCode ?? 500;
    reply.status(statusCode).send({
      error: statusCode >= 500 ? 'INTERNAL_SERVER_ERROR' : appError.message,
    });
  });

  // 注册顺序保持为：跨域/基础中间件 -> 数据库 -> 鉴权 -> 业务路由。
  // 注册 CORS（跨域资源共享）插件。允许来自 env.FRONTEND_ORIGIN 指定域名的前端请求访问这个后端 API，credentials: true 表示允许携带 Cookie / Authorization 头等凭证信息。
  await app.register(cors, {
    origin: env.FRONTEND_ORIGIN,
    credentials: true,
  });
  // 注册 Cookie 插件，用于解析和设置 HTTP Cookie。secret 用于对签名 Cookie 进行签名/验证，这里复用了 JWT_SECRET 作为签名密钥。
  await app.register(cookie, { secret: env.JWT_SECRET });
  // 注册全局限流插件。限制每个客户端 IP 在 1 分钟内最多发起 120 次请求，超出后返回 429 Too Many Requests，防止接口被刷。
  await app.register(rateLimit, {
    max: 120,
    timeWindow: '1 minute',
  });
  // 注册 Prisma 数据库插件，将 Prisma Client 实例挂载到 Fastify 应用上，使后续所有路由都能通过 app.prisma 访问数据库。
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
