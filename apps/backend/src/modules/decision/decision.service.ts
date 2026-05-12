import type { Prisma, PrismaClient } from '@prisma/client';
import type { BrainAnalysis, BrainType, DecisionSession } from '@magi/shared';
import { env } from '../../config/env.js';
import { createAiProviderService } from '../ai-provider/ai-provider.service.js';
import {
  analyzeWithBrain,
  analyzeWithMelchior,
  createBrainFailureResult,
  createPendingAnalyses,
  createPendingDecision,
  createPlaceholderDecisionSummary,
  createRefusedDecision,
  deriveDecisionContext,
  isObviousRiskQuestion,
  mergeBrainAnalyses,
  shouldRefuseForMissingVariables,
  summarizeWithCore,
} from './decision-orchestrator.js';
import type { CreateDecisionSessionInput } from './decision.schema.js';
import type { LlmConfig } from './llm-client.js';

const PIPELINE_FAILED_REASON = '裁决链路执行失败，主控已拒绝裁决';
const CRITICAL_VARIABLE_MISSING_REASON = '关键变量缺失，当前无法负责地下结论';
const OBVIOUS_RISK_REJECT_SUMMARY = '基础规则与安全风险已足够明确，本次裁决直接否决';
const BRAIN_TYPES: BrainType[] = ['melchior', 'balthasar', 'casper'];

type BrainAnalysisMap = Record<BrainType, BrainAnalysis>;

const isBrainAnalysis = (value: unknown): value is BrainAnalysis => {
  const row = value && typeof value === 'object' ? value as Partial<BrainAnalysis> : null;

  return Boolean(row?.brainType && BRAIN_TYPES.includes(row.brainType));
};

const toAnalysisMap = (analyses: BrainAnalysis[]): BrainAnalysisMap => analyses.reduce(
  (result: BrainAnalysisMap, analysis: BrainAnalysis): BrainAnalysisMap => ({
    ...result,
    [analysis.brainType]: analysis,
  }),
  {} as BrainAnalysisMap,
);

const toAnalysisList = (value: unknown): BrainAnalysis[] => {
  if (Array.isArray(value)) {
    return value.filter(isBrainAnalysis);
  }

  if (!value || typeof value !== 'object') {
    return [];
  }

  const row = value as Partial<Record<BrainType, unknown>>;

  return BRAIN_TYPES
    .map((brainType: BrainType): unknown => row[brainType])
    .filter(isBrainAnalysis);
};

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
  analyses: toAnalysisList(session.analysesJson),
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

const isBrainCompleted = (analysis: BrainAnalysis): boolean => analysis.status === 'completed' || analysis.status === 'failed';

const toRunningAnalysis = (analysis: BrainAnalysis): BrainAnalysis => ({
  ...analysis,
  status: 'running',
  reason: `${analysis.brainType.toUpperCase()} 分析中`,
  focusPoints: ['裁决执行中'],
  uncertainties: ['等待模型返回'],
  unavailable: false,
});

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

  if (error.message === 'DECISION_SERVICE_UNAVAILABLE' && rootError.name === 'AbortError') {
    return '模型服务请求超时，请稍后重试';
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

  const updateBrainAnalysis = async (
    sessionId: string,
    analysis: BrainAnalysis,
  ): Promise<void> => {
    await prisma.$executeRaw`
      UPDATE DecisionSession
      SET analysesJson = JSON_SET(analysesJson, ${`$.${analysis.brainType}`}, JSON_EXTRACT(${JSON.stringify(analysis)}, '$'))
      WHERE id = ${sessionId}
    `;
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
      const context = await deriveDecisionContext({ question, config });

      state.questionType = context.questionType;
      state.variables = context.variables;
      state.analyses = createPendingAnalyses(context);

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
            questionType: state.questionType,
            processingStage: refusedDecision.processingStage,
            processingStatus: refusedDecision.processingStatus,
            finalStatus: refusedDecision.finalStatus,
            summary: refusedDecision.summary,
            confidence: refusedDecision.confidence,
            variablesJson: toJsonValue(refusedDecision.variables),
            analysesJson: toJsonValue(toAnalysisMap(refusedDecision.analyses)),
            summaryJson: toJsonValue({
              ...refusedDecision.decisionSummary,
              missingInformation: [...new Set([
                ...refusedDecision.decisionSummary.missingInformation,
                ...context.missingInformation,
              ])],
            }),
          },
        });

        return;
      }

      state.processingStage = 'brains';
      state.processingStatus = 'running';
      state.analyses = state.analyses.map(toRunningAnalysis);

      await prisma.decisionSession.update({
        where: { id: sessionId },
        data: {
          questionType: state.questionType,
          processingStage: state.processingStage,
          processingStatus: state.processingStatus,
          variablesJson: toJsonValue(state.variables),
          analysesJson: toJsonValue(toAnalysisMap(state.analyses)),
        },
      });

      const runBrain = async (brainType: BrainType): Promise<void> => {
        let nextAnalysis: BrainAnalysis;

        try {
          nextAnalysis = brainType === 'melchior'
            ? await analyzeWithMelchior({
              question,
              questionType: state.questionType,
              variables: state.variables,
              config,
            })
            : await analyzeWithBrain(brainType as Exclude<BrainType, 'melchior'>, {
              question,
              questionType: state.questionType,
              variables: state.variables,
              config,
            });
        } catch (error) {
          nextAnalysis = createBrainFailureResult(brainType, toBrainFailureReason(error), {
            questionType: state.questionType,
            variables: state.variables,
          });
        }

        state.analyses = replaceAnalysis(state.analyses, nextAnalysis);
        await updateBrainAnalysis(sessionId, nextAnalysis);
      };

      await Promise.all([
        runBrain('melchior'),
        runBrain('balthasar'),
        runBrain('casper'),
      ]);

      if (!state.analyses.every(isBrainCompleted)) {
        throw new Error('BRAIN_PIPELINE_INCOMPLETE');
      }

      const merged = mergeBrainAnalyses(state.analyses);
      state.processingStage = 'core';

      await prisma.decisionSession.update({
        where: { id: sessionId },
        data: {
          questionType: state.questionType,
          variablesJson: toJsonValue(state.variables),
          processingStage: state.processingStage,
          analysesJson: toJsonValue(toAnalysisMap(state.analyses)),
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
          missingInformation: [...new Set([
            ...context.missingInformation,
            ...merged.missingInformation,
          ])],
          finalDecision: 'REJECTED - 基础规则与安全风险已足够明确，本次裁决直接否决。',
        }
        : {
          ...coreDecision.decisionSummary,
          missingInformation: [...new Set([
            ...context.missingInformation,
            ...coreDecision.decisionSummary.missingInformation,
            ...merged.missingInformation,
          ])],
        };

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
          analysesJson: toJsonValue(toAnalysisMap(state.analyses)),
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
          analysesJson: toJsonValue(toAnalysisMap(state.analyses)),
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
          analysesJson: toJsonValue(toAnalysisMap(draft.analyses)),
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
