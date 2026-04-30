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
  // token 只承载 userId；权限和用户信息每次从数据库读取，避免权限变更后旧 token 失效不及时。
  const createToken = (userId: string): string => jwt.sign({ userId }, env.JWT_SECRET, { expiresIn: '7d' });

  return {
    async register(input: AuthInput): Promise<AuthSession> {
      const existing = await prisma.user.findUnique({ where: { email: input.email } });

      // 邮箱唯一性在业务层提前返回 409，避免 Prisma 错误直接暴露给接口层。
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

      // 账号不存在和密码错误统一返回，避免泄露邮箱是否已注册。
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
