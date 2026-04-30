import type { FastifyInstance } from 'fastify';
import { saveAiProviderConfigSchema } from './ai-provider.schema.js';
import { createAiProviderService, type MaskedAiProviderConfig } from './ai-provider.service.js';

const assertAllowed = async (app: FastifyInstance, userId: string): Promise<void> => {
  const user = await app.prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { canConfigureAiProvider: true },
  });

  if (!user.canConfigureAiProvider) {
    const error = new Error('FORBIDDEN') as Error & { statusCode: number };
    error.statusCode = 403;
    throw error;
  }
};

export const aiProviderRoutes = async (app: FastifyInstance): Promise<void> => {
  const service = createAiProviderService(app.prisma);

  app.get('/api/ai-provider-config', { preHandler: app.authenticate }, async (request): Promise<MaskedAiProviderConfig | null> => {
    await assertAllowed(app, request.userId as string);
    return service.getMasked(request.userId as string);
  });

  app.put('/api/ai-provider-config', { preHandler: app.authenticate }, async (request): Promise<MaskedAiProviderConfig> => {
    await assertAllowed(app, request.userId as string);
    return service.save(request.userId as string, saveAiProviderConfigSchema.parse(request.body));
  });
};
