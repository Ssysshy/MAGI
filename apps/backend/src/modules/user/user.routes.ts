import type { FastifyInstance } from 'fastify';
import type { AiProviderMode, CurrentUser, UserCapabilities } from '@magi/shared';

export const userRoutes = async (app: FastifyInstance): Promise<void> => {
  app.get('/api/me', { preHandler: app.authenticate }, async (request): Promise<CurrentUser> => {
    // 当前用户接口返回前端渲染身份所需的最小字段。
    const user = await app.prisma.user.findUniqueOrThrow({
      where: { id: request.userId },
      select: {
        id: true,
        email: true,
        role: true,
        canConfigureAiProvider: true,
      },
    });

    return {
      id: user.id,
      email: user.email,
      role: user.role === 'admin' ? 'admin' : 'user',
      canConfigureAiProvider: user.canConfigureAiProvider,
    };
  });

  app.get('/api/me/capabilities', { preHandler: app.authenticate }, async (request): Promise<UserCapabilities> => {
    // 能力接口集中判断 AI 配置入口，前端只按结果控制浮球和配置页。
    const user = await app.prisma.user.findUniqueOrThrow({
      where: { id: request.userId },
      include: { aiProviderConfig: true },
    });
    const aiProviderMode: AiProviderMode = user.canConfigureAiProvider && user.aiProviderConfig?.enabled ? 'custom' : 'system';

    return {
      canConfigureAiProvider: user.canConfigureAiProvider,
      aiProviderMode,
    };
  });
};
