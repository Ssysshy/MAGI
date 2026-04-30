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
  // Prisma 中 JSON 字段在这里恢复为 shared 类型，保证前端拿到统一结构。
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

    // 用户未授权或未启用个人配置时，强制回退到系统 AI API。
    return customConfig ?? {
      provider: env.SYSTEM_AI_PROVIDER,
      baseUrl: env.SYSTEM_AI_BASE_URL,
      model: env.SYSTEM_AI_MODEL,
      apiKey: env.SYSTEM_AI_API_KEY,
    };
  };

  return {
    async create(userId: string, input: CreateDecisionSessionInput): Promise<DecisionSession> {
      // 先完成裁决编排，再把一次完整裁决快照写入历史。
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
      // 历史列表只取当前用户最近 50 条，避免无分页场景下返回过大。
      const sessions = await prisma.decisionSession.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });

      return sessions.map(toDecisionSession);
    },

    async get(userId: string, id: string): Promise<DecisionSession> {
      // 同时限定 id 和 userId，防止通过会话 id 读取其他用户历史。
      const session = await prisma.decisionSession.findFirstOrThrow({
        where: { id, userId },
      });

      return toDecisionSession(session);
    },
  };
};
