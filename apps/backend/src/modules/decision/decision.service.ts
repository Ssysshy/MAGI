import type { PrismaClient } from '@prisma/client';
import type { DecisionSession } from '@magi/shared';
import { env } from '../../config/env.js';
import { createAiProviderService } from '../ai-provider/ai-provider.service.js';
import { orchestrateDecision } from './decision-orchestrator.js';
import type { CreateDecisionSessionInput } from './decision.schema.js';
import type { LlmConfig } from './llm-client.js';

const toDecisionSession = (session: {
  id: string;
  userId: string;
  question: string;
  questionType: string;
  finalStatus: string;
  summary: string;
  confidence: number;
  variablesJson: unknown;
  analysesJson: unknown;
  summaryJson: unknown;
  createdAt: Date;
}): DecisionSession => ({
  id: session.id,
  userId: session.userId,
  question: session.question,
  questionType: session.questionType as DecisionSession['questionType'],
  finalStatus: session.finalStatus as DecisionSession['finalStatus'],
  summary: session.summary,
  confidence: session.confidence,
  variables: session.variablesJson as DecisionSession['variables'],
  analyses: session.analysesJson as DecisionSession['analyses'],
  decisionSummary: session.summaryJson as DecisionSession['decisionSummary'],
  createdAt: session.createdAt.toISOString(),
});

export const createDecisionService = (prisma: PrismaClient) => {
  const aiProviderService = createAiProviderService(prisma);

  const getLlmConfig = async (userId: string): Promise<LlmConfig> => {
    const customConfig = await aiProviderService.getUsableConfig(userId);

    return customConfig ?? {
      provider: env.SYSTEM_AI_PROVIDER,
      baseUrl: env.SYSTEM_AI_BASE_URL,
      model: env.SYSTEM_AI_MODEL,
      apiKey: env.SYSTEM_AI_API_KEY,
    };
  };

  return {
    async create(userId: string, input: CreateDecisionSessionInput): Promise<DecisionSession> {
      const draft = await orchestrateDecision({
        userId,
        question: input.question,
        config: await getLlmConfig(userId),
      });

      const session = await prisma.decisionSession.create({
        data: {
          userId,
          question: draft.question,
          questionType: draft.questionType,
          finalStatus: draft.finalStatus,
          summary: draft.summary,
          confidence: draft.confidence,
          variablesJson: draft.variables,
          analysesJson: draft.analyses,
          summaryJson: draft.decisionSummary,
        },
      });

      return toDecisionSession(session);
    },

    async list(userId: string): Promise<DecisionSession[]> {
      const sessions = await prisma.decisionSession.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });

      return sessions.map(toDecisionSession);
    },

    async get(userId: string, id: string): Promise<DecisionSession> {
      const session = await prisma.decisionSession.findFirstOrThrow({
        where: { id, userId },
      });

      return toDecisionSession(session);
    },
  };
};
