import fp from 'fastify-plugin';
import jwt from 'jsonwebtoken';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { env } from '../config/env.js';

interface SessionPayload {
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

const authPlugin: FastifyPluginAsync = async (app) => {
  app.decorate('authenticate', async (request: FastifyRequest): Promise<void> => {
    const token = request.cookies.magi_session;

    if (!token) {
      const error = new Error('UNAUTHORIZED') as Error & { statusCode: number };
      error.statusCode = 401;
      throw error;
    }

    const payload = jwt.verify(token, env.JWT_SECRET) as SessionPayload;
    request.userId = payload.userId;
  });
};

export default fp(authPlugin);
