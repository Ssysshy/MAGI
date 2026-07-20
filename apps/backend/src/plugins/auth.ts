import fp from 'fastify-plugin';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { env } from '../config/env.js';

interface SessionPayload extends JwtPayload {
  userId: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    userId?: string;
  }

  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

const createUnauthorizedError = (): Error & { statusCode: number } => {
  const error = new Error('UNAUTHORIZED') as Error & { statusCode: number };
  error.statusCode = 401;
  return error;
};

const getBearerToken = (authorizationHeader: string | undefined): string | null => {
  if (!authorizationHeader) {
    return null;
  }

  const [scheme, token] = authorizationHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return null;
  }

  return token;
};

const isSessionPayload = (payload: string | JwtPayload): payload is SessionPayload => (
  typeof payload !== 'string'
  && typeof payload.userId === 'string'
  && payload.userId.length > 0
);

const authPlugin: FastifyPluginAsync = async (app) => {
  app.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    // 优先读取 Authorization，兼容旧 Cookie 会话，保证 H5 和小程序都可访问。
    const token = getBearerToken(request.headers.authorization) ?? request.cookies.magi_session;

    if (!token) {
      throw createUnauthorizedError();
    }

    try {
      // 只把 userId 挂到 request，业务模块再自行读取所需用户字段。
      const payload = jwt.verify(token, env.JWT_SECRET);

      if (!isSessionPayload(payload)) {
        throw createUnauthorizedError();
      }

      request.userId = payload.userId;

      const user = await app.prisma.user.findUnique({
        where: { id: payload.userId },
        select: { id: true },
      });
      if (!user) {
        if (request.cookies.magi_session) {
          reply.clearCookie('magi_session', { path: '/' });
        }
        throw createUnauthorizedError();
      }
    } catch {
      throw createUnauthorizedError();
    }
  });
};

export default fp(authPlugin);
