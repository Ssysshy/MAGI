import type { FastifyInstance } from 'fastify';
import { authInputSchema } from './auth.schema.js';
import { createAuthService } from './auth.service.js';

const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 24 * 7,
};

export const authRoutes = async (app: FastifyInstance): Promise<void> => {
  const service = createAuthService(app.prisma);

  app.post('/api/auth/register', async (request, reply) => {
    const session = await service.register(authInputSchema.parse(request.body));
    // 保留 Cookie 兼容 H5，同时把 accessToken 返回给小程序侧存储。
    reply.setCookie('magi_session', session.token, cookieOptions);
    return {
      accessToken: session.accessToken,
      user: session.user,
    };
  });

  app.post('/api/auth/login', async (request, reply) => {
    const session = await service.login(authInputSchema.parse(request.body));
    // 登录和注册返回统一鉴权结构，前端按平台自行持久化。
    reply.setCookie('magi_session', session.token, cookieOptions);
    return {
      accessToken: session.accessToken,
      user: session.user,
    };
  });

  app.post('/api/auth/logout', async (_request, reply): Promise<{ ok: true }> => {
    reply.clearCookie('magi_session', { path: '/' });
    return { ok: true };
  });
};
