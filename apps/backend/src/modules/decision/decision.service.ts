import type { Prisma, PrismaClient } from '@prisma/client';
import type { BrainAnalysis, BrainType, DecisionSession } from '@magi/shared';
import { env } from '../../config/env.js';
import { createAiProviderService } from '../ai-provider/ai-provider.service.js';
import {
  analyzeWithBrain,
  analyzeWithMelchior,
  createBrainFailureResult,
  createPendingDecision,
  createPlaceholderDecisionSummary,
  createRefusedDecision,
  isObviousRiskQuestion,
  shouldRefuseForMissingVariables,
  summarizeWithCore,
} from './decision-orchestrator.js';
import type { CreateDecisionSessionInput } from './decision.schema.js';
import type { LlmConfig } from './llm-client.js';

const PIPELINE_FAILED_REASON = '裁决链路执行失败，主控已拒绝裁决';
const CRITICAL_VARIABLE_MISSING_REASON = '关键变量缺失，当前无法负责地下结论';
const BRAIN_RUNNING_REASON: Record<BrainType, string> = {
  melchior: 'Melchior 分析中',
  balthasar: 'Balthasar 分析中',
  casper: 'Casper 分析中',
};
const OBVIOUS_RISK_REJECT_SUMMARY = '基础规则与安全风险已足够明确，本次裁决直接否决';

const toDecisionSession = (session: {
  id: string;
  userId: string;
  question: string;
  questionType: string;
  processingStage: string;
  processingStatus: string;
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
  processingStage: session.processingStage as DecisionSession['processingStage'],
  processingStatus: session.processingStatus as DecisionSession['processingStatus'],
  finalStatus: session.finalStatus as DecisionSession['finalStatus'],
  summary: session.summary,
  confidence: session.confidence,
  variables: session.variablesJson as DecisionSession['variables'],
  analyses: session.analysesJson as DecisionSession['analyses'],
  decisionSummary: session.summaryJson as DecisionSession['decisionSummary'],
  createdAt: session.createdAt.toISOString(),
});

const replaceAnalysis = (
  analyses: BrainAnalysis[],
  nextAnalysis: BrainAnalysis,
): BrainAnalysis[] => analyses.map((analysis: BrainAnalysis): BrainAnalysis => (
  analysis.brainType === nextAnalysis.brainType ? nextAnalysis : analysis
));

const toJsonValue = (value: unknown): Prisma.InputJsonValue => value as Prisma.InputJsonValue;
const hasRejectAnalysis = (analyses: BrainAnalysis[]): boolean => analyses.some(
  (analysis: BrainAnalysis): boolean => analysis.status === 'completed' && analysis.stance === 'reject',
);
const toBrainFailureReason = (error: unknown): string => {
  if (!(error instanceof Error)) {
    return '模型服务暂不可用，请稍后重试';
  }

  const rootError = error.message === 'DECISION_SERVICE_UNAVAILABLE'
    ? ((error as Error & { cause?: unknown }).cause instanceof Error
      ? (error as Error & { cause?: Error }).cause
      : error)
    : error;

  if (!(rootError instanceof Error)) {
    return '模型服务暂不可用，请稍后重试';
  }

  if (error.message === 'DECISION_SERVICE_UNAVAILABLE') {
    if (rootError.name === 'AbortError') {
      return '模型服务请求超时，请稍后重试';
    }
  }

  if (rootError.message.startsWith('LLM_HTTP_')) {
    const statusRaw = rootError.message.replace('LLM_HTTP_', '');
    const status = Number.parseInt(statusRaw, 10);

    if (status === 401 || status === 403) {
      return '模型服务鉴权失败，请检查 API Key 或权限';
    }

    if (status === 429) {
      return '模型服务限流，请稍后重试';
    }

    if (!Number.isNaN(status) && status >= 500) {
      return '模型服务暂不可用，请稍后重试';
    }

    return '模型服务响应异常，请稍后重试';
  }

  if (rootError.message === 'LLM_EMPTY_CONTENT' || rootError.message === 'LLM_JSON_PARSE_FAILED') {
    return '模型返回格式异常，请稍后重试';
  }

  if (rootError.message === 'LLM_SCHEMA_PARTIAL_INVALID') {
    return '模型返回结构不完整，请稍后重试';
  }

  if (rootError.name === 'ZodError') {
    return '模型返回结构不完整，请稍后重试';
  }

  if (error.message === 'DECISION_SERVICE_UNAVAILABLE') {
    return '模型服务暂不可用，请稍后重试';
  }

  return rootError.message;
};

const markBrainRunning = (
  analyses: BrainAnalysis[],
  brainType: BrainType,
): BrainAnalysis[] => analyses.map((analysis: BrainAnalysis): BrainAnalysis => {
  if (analysis.brainType !== brainType) {
    return analysis;
  }

  return {
    ...analysis,
    status: 'running',
    reason: BRAIN_RUNNING_REASON[brainType],
    focusPoints: ['裁决执行中'],
    uncertainties: ['等待模型返回'],
    unavailable: false,
  };
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

  const runDecisionPipeline = async (
    sessionId: string,
    userId: string,
    question: string,
  ): Promise<void> => {
    const state = createPendingDecision(userId, question);
    const obviousRiskQuestion = isObviousRiskQuestion(question);

    try {
      const config = await getLlmConfig(userId);

      state.processingStage = 'melchior';
      state.analyses = markBrainRunning(state.analyses, 'melchior');

      await prisma.decisionSession.update({
        where: { id: sessionId },
        data: {
          processingStage: state.processingStage,
          processingStatus: state.processingStatus,
          analysesJson: toJsonValue(state.analyses),
        },
      });

      try {
        const melchiorDecision = await analyzeWithMelchior({ question, config });
        state.questionType = melchiorDecision.questionType;
        state.variables = melchiorDecision.variables;
        state.analyses = replaceAnalysis(state.analyses, melchiorDecision.analysis);
      } catch (error) {
        state.analyses = replaceAnalysis(state.analyses, createBrainFailureResult('melchior', toBrainFailureReason(error)));
      }

      if (!obviousRiskQuestion && shouldRefuseForMissingVariables(state.variables)) {
        const refusedDecision = createRefusedDecision(
          userId,
          question,
          CRITICAL_VARIABLE_MISSING_REASON,
          state.variables,
          state.analyses,
        );

        await prisma.decisionSession.update({
          where: { id: sessionId },
          data: {
            questionType: refusedDecision.questionType,
            processingStage: refusedDecision.processingStage,
            processingStatus: refusedDecision.processingStatus,
            finalStatus: refusedDecision.finalStatus,
            summary: refusedDecision.summary,
            confidence: refusedDecision.confidence,
            variablesJson: toJsonValue(refusedDecision.variables),
            analysesJson: toJsonValue(refusedDecision.analyses),
            summaryJson: toJsonValue(refusedDecision.decisionSummary),
          },
        });

        return;
      }

      state.processingStage = 'balthasar';
      state.analyses = markBrainRunning(state.analyses, 'balthasar');

      await prisma.decisionSession.update({
        where: { id: sessionId },
        data: {
          questionType: state.questionType,
          processingStage: state.processingStage,
          variablesJson: toJsonValue(state.variables),
          analysesJson: toJsonValue(state.analyses),
        },
      });

      try {
        state.analyses = replaceAnalysis(state.analyses, await analyzeWithBrain('balthasar', {
          question,
          questionType: state.questionType,
          variables: state.variables,
          config,
        }));
      } catch (error) {
        state.analyses = replaceAnalysis(state.analyses, createBrainFailureResult('balthasar', toBrainFailureReason(error)));
      }

      state.processingStage = 'casper';
      state.analyses = markBrainRunning(state.analyses, 'casper');

      await prisma.decisionSession.update({
        where: { id: sessionId },
        data: {
          processingStage: state.processingStage,
          analysesJson: toJsonValue(state.analyses),
        },
      });

      try {
        state.analyses = replaceAnalysis(state.analyses, await analyzeWithBrain('casper', {
          question,
          questionType: state.questionType,
          variables: state.variables,
          config,
        }));
      } catch (error) {
        state.analyses = replaceAnalysis(state.analyses, createBrainFailureResult('casper', toBrainFailureReason(error)));
      }

      state.processingStage = 'core';

      await prisma.decisionSession.update({
        where: { id: sessionId },
        data: {
          processingStage: state.processingStage,
          analysesJson: toJsonValue(state.analyses),
        },
      });

      const coreDecision = await summarizeWithCore({
        question,
        questionType: state.questionType,
        variables: state.variables,
        analyses: state.analyses,
        config,
      });
      const forceReject = obviousRiskQuestion && hasRejectAnalysis(state.analyses);
      const finalStatus = forceReject ? 'rejected' : coreDecision.finalStatus;
      const summary = forceReject ? OBVIOUS_RISK_REJECT_SUMMARY : coreDecision.summary;
      const confidence = forceReject ? Math.max(coreDecision.confidence, 0.82) : coreDecision.confidence;
      const decisionSummary = forceReject
        ? {
            ...coreDecision.decisionSummary,
            rule: '公共规则明确或基础安全风险明确时，优先直接否决',
            majorityOpinion: '至少一个裁决角色已明确否决，且问题属于明显高风险/违法场景',
            finalDecision: 'REJECTED - 基础规则与安全风险已足够明确，本次裁决直接否决。',
          }
        : coreDecision.decisionSummary;

      await prisma.decisionSession.update({
        where: { id: sessionId },
        data: {
          questionType: state.questionType,
          processingStage: 'completed',
          processingStatus: 'completed',
          finalStatus,
          summary,
          confidence,
          variablesJson: toJsonValue(state.variables),
          analysesJson: toJsonValue(state.analyses),
          summaryJson: toJsonValue(decisionSummary),
        },
      });
    } catch (error) {
      console.error('[decision.pipeline.failed]', {
        sessionId,
        userId,
        processingStage: state.processingStage,
        errorName: error instanceof Error ? error.name : 'UnknownError',
        errorMessage: error instanceof Error ? error.message : String(error),
      });

      await prisma.decisionSession.update({
        where: { id: sessionId },
        data: {
          processingStage: 'failed',
          processingStatus: 'failed',
          finalStatus: 'refused',
          summary: PIPELINE_FAILED_REASON,
          confidence: 0,
          variablesJson: toJsonValue(state.variables),
          analysesJson: toJsonValue(state.analyses),
          summaryJson: toJsonValue(createPlaceholderDecisionSummary(PIPELINE_FAILED_REASON)),
        },
      });
    }
  };

  return {
    async create(userId: string, input: CreateDecisionSessionInput): Promise<DecisionSession> {
      const draft = createPendingDecision(userId, input.question);
      const session = await prisma.decisionSession.create({
        data: {
          userId,
          question: draft.question,
          questionType: draft.questionType,
          processingStage: draft.processingStage,
          processingStatus: draft.processingStatus,
          finalStatus: draft.finalStatus,
          summary: draft.summary,
          confidence: draft.confidence,
          variablesJson: toJsonValue(draft.variables),
          analysesJson: toJsonValue(draft.analyses),
          summaryJson: toJsonValue(draft.decisionSummary),
        },
      });

      void runDecisionPipeline(session.id, userId, input.question);

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
