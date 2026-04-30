import type { FastifyInstance } from 'fastify';
import type { AiProviderMode, CurrentUser, UserCapabilities } from '@magi/shared';

export const userRoutes = async (app: FastifyInstance): Promise<void> => {
  app.get('/api/me', { preHandler: app.authenticate }, async (request): Promise<CurrentUser> => {
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
