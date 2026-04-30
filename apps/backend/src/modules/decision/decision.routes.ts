import type { FastifyInstance } from 'fastify';
import { createDecisionSessionSchema } from './decision.schema.js';
import { createDecisionService } from './decision.service.js';

export const decisionRoutes = async (app: FastifyInstance): Promise<void> => {
  const service = createDecisionService(app.prisma);

  app.post('/api/decision-sessions', { preHandler: app.authenticate }, async (request) => {
    return service.create(request.userId as string, createDecisionSessionSchema.parse(request.body));
  });

  app.get('/api/decision-sessions', { preHandler: app.authenticate }, async (request) => {
    return service.list(request.userId as string);
  });

  app.get<{ Params: { id: string } }>('/api/decision-sessions/:id', { preHandler: app.authenticate }, async (request) => {
    return service.get(request.userId as string, request.params.id);
  });
};
