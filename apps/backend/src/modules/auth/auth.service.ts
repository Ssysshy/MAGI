import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import type { PrismaClient, User } from '@prisma/client';
import { env } from '../../config/env.js';
import type { AuthInput } from './auth.schema.js';

export interface AuthSession {
  token: string;
  user: Pick<User, 'id' | 'email' | 'role' | 'canConfigureAiProvider'>;
}

const toPublicUser = (user: User): AuthSession['user'] => ({
  id: user.id,
  email: user.email,
  role: user.role,
  canConfigureAiProvider: user.canConfigureAiProvider,
});

export const createAuthService = (prisma: PrismaClient) => {
  const createToken = (userId: string): string => jwt.sign({ userId }, env.JWT_SECRET, { expiresIn: '7d' });

  return {
    async register(input: AuthInput): Promise<AuthSession> {
      const existing = await prisma.user.findUnique({ where: { email: input.email } });

      if (existing) {
        const error = new Error('EMAIL_EXISTS') as Error & { statusCode: number };
        error.statusCode = 409;
        throw error;
      }

      const user = await prisma.user.create({
        data: {
          email: input.email,
          passwordHash: await argon2.hash(input.password),
        },
      });

      return {
        token: createToken(user.id),
        user: toPublicUser(user),
      };
    },

    async login(input: AuthInput): Promise<AuthSession> {
      const user = await prisma.user.findUnique({ where: { email: input.email } });

      if (!user || !(await argon2.verify(user.passwordHash, input.password))) {
        const error = new Error('INVALID_CREDENTIALS') as Error & { statusCode: number };
        error.statusCode = 401;
        throw error;
      }

      return {
        token: createToken(user.id),
        user: toPublicUser(user),
      };
    },
  };
};
