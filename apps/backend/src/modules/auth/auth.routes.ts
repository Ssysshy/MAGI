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
    // 登录态只写入 Cookie，响应体只返回安全的用户字段。
    reply.setCookie('magi_session', session.token, cookieOptions);
    return session.user;
  });

  app.post('/api/auth/login', async (request, reply) => {
    const session = await service.login(authInputSchema.parse(request.body));
    // 登录和注册使用同一 Cookie 策略，前端无需区分会话来源。
    reply.setCookie('magi_session', session.token, cookieOptions);
    return session.user;
  });

  app.post('/api/auth/logout', async (_request, reply): Promise<{ ok: true }> => {
    reply.clearCookie('magi_session', { path: '/' });
    return { ok: true };
  });
};
