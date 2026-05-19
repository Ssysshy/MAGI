import fp from 'fastify-plugin';
import { PrismaClient } from '@prisma/client';
import type { FastifyPluginAsync } from 'fastify';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

const prismaPlugin: FastifyPluginAsync = async (app) => {
  // 创建 PrismaClient 实例并连接数据库
  const prisma = new PrismaClient();
  await prisma.$connect();

  // 通过 Fastify decorate 共享单个 PrismaClient，避免每个模块重复建连接。
  // 用 decorate 把 prisma 实例挂到 app 上，全局共享同一个连接
  app.decorate('prisma', prisma);
  // 注册 onClose 钩子，服务关闭时断开数据库连接，防止连接泄漏
  app.addHook('onClose', async () => {
    await prisma.$disconnect();
  });
};

export default fp(prismaPlugin);
