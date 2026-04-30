import fp from 'fastify-plugin';
import { PrismaClient } from '@prisma/client';
import type { FastifyPluginAsync } from 'fastify';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

const prismaPlugin: FastifyPluginAsync = async (app) => {
  const prisma = new PrismaClient();
  await prisma.$connect();

  // 通过 Fastify decorate 共享单个 PrismaClient，避免每个模块重复建连接。
  app.decorate('prisma', prisma);
  app.addHook('onClose', async () => {
    await prisma.$disconnect();
  });
};

export default fp(prismaPlugin);
