import fp from 'fastify-plugin';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { env } from '../config/env.js';

interface SessionPayload extends JwtPayload {
  userId: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    userId?: string;
  }

  interface FastifyInstance {
    authenticate: (request: FastifyRequest) => Promise<void>;
  }
}

const createUnauthorizedError = (): Error & { statusCode: number } => {
  const error = new Error('UNAUTHORIZED') as Error & { statusCode: number };
  error.statusCode = 401;
  return error;
};

const isSessionPayload = (payload: string | JwtPayload): payload is SessionPayload => (
  typeof payload !== 'string'
  && typeof payload.userId === 'string'
  && payload.userId.length > 0
);

const authPlugin: FastifyPluginAsync = async (app) => {
  app.decorate('authenticate', async (request: FastifyRequest): Promise<void> => {
    // 所有受保护接口都从 HttpOnly Cookie 读取会话，避免前端直接持有 token。
    const token = request.cookies.magi_session;

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
    } catch {
      throw createUnauthorizedError();
    }
  });
};

export default fp(authPlugin);
