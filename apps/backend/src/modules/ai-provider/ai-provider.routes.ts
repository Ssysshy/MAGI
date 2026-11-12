import type { FastifyInstance } from 'fastify';
import { saveAiProviderConfigSchema } from './ai-provider.schema.js';
import { createAiProviderService, type MaskedAiProviderConfig } from './ai-provider.service.js';

export const aiProviderRoutes = async (app: FastifyInstance): Promise<void> => {
  const service = createAiProviderService(app.prisma);

  app.get('/api/ai-provider-config', { preHandler: app.authenticate }, async (request): Promise<MaskedAiProviderConfig | null> => {
    return service.getMasked(request.userId as string);
  });

  app.put('/api/ai-provider-config', { preHandler: app.authenticate }, async (request): Promise<MaskedAiProviderConfig> => {
    return service.save(request.userId as string, saveAiProviderConfigSchema.parse(request.body));
  });
};
