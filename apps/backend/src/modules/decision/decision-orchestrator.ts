import Bottleneck from 'bottleneck';
import pLimit from 'p-limit';
import { z } from 'zod';
import type { DecisionSession, FinalStatus } from '@magi/shared';
import { requestLlmJson, type LlmConfig } from './llm-client.js';

const decisionLimit = pLimit(5);
const llmLimiter = new Bottleneck({
  minTime: 500,
  maxConcurrent: 3,
});

const brainAnalysisSchema = z.object({
  brainType: z.enum(['melchior', 'balthasar', 'casper']),
  stance: z.enum(['approve', 'reject', 'defer', 'uncertain']),
  reason: z.string(),
  focusPoints: z.array(z.string()),
  uncertainties: z.array(z.string()),
  unavailable: z.boolean().optional(),
});

const decisionDraftSchema = z.object({
  userId: z.string(),
  question: z.string(),
  questionType: z.enum(['boolean', 'multiple_choice', 'priority', 'strategy', 'diagnosis']),
  finalStatus: z.enum(['approved', 'rejected', 'deferred', 'refused']),
  summary: z.string(),
  confidence: z.number().min(0).max(1),
  variables: z.array(z.object({
    name: z.string(),
    value: z.string(),
    isMissing: z.boolean(),
    isCritical: z.boolean(),
  })),
  analyses: z.array(brainAnalysisSchema).length(3),
  decisionSummary: z.object({
    rule: z.string(),
    majorityOpinion: z.string(),
    minorityOpinion: z.string(),
    missingInformation: z.array(z.string()),
    finalDecision: z.string(),
  }),
});

export interface OrchestrateDecisionInput {
  userId: string;
  question: string;
  config: LlmConfig;
}

type DecisionDraft = Omit<DecisionSession, 'id' | 'createdAt'>;
type BrainType = 'melchior' | 'balthasar' | 'casper';
type AppError = Error & { statusCode: number };

const BRAIN_TYPES: BrainType[] = ['melchior', 'balthasar', 'casper'];

const toText = (value: unknown): string => {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return '';
};

const toQuestionType = (value: unknown): DecisionDraft['questionType'] => {
  const raw = toText(value);

  if (raw === 'boolean' || raw === 'multiple_choice' || raw === 'priority' || raw === 'strategy' || raw === 'diagnosis') {
    return raw;
  }

  return 'strategy';
};

const toConfidence = (value: unknown): number => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 0;
  }

  if (value < 0) {
    return 0;
  }

  if (value > 1) {
    return 1;
  }

  return value;
};

const toVariables = (value: unknown): DecisionDraft['variables'] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item): DecisionDraft['variables'][number] | null => {
      if (typeof item === 'string') {
        const name = item.trim();
        if (!name) {
          return null;
        }

        return {
          name,
          value: '',
          isMissing: true,
          isCritical: false,
        };
      }

      if (!item || typeof item !== 'object') {
        return null;
      }

      const row = item as Record<string, unknown>;
      const name = toText(row.name);

      if (!name) {
        return null;
      }

      return {
        name,
        value: toText(row.value),
        isMissing: typeof row.isMissing === 'boolean' ? row.isMissing : false,
        isCritical: typeof row.isCritical === 'boolean' ? row.isCritical : false,
      };
    })
    .filter((item): item is DecisionDraft['variables'][number] => item !== null);
};

const toBrainAnalysis = (
  brainType: BrainType,
  value: unknown,
): DecisionDraft['analyses'][number] => {
  const row = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  const reason = toText(row.reason) || toText(row.analysis) || toText(value) || '信息不足';
  const stanceRaw = toText(row.stance);
  const stance = stanceRaw === 'approve' || stanceRaw === 'reject' || stanceRaw === 'defer' || stanceRaw === 'uncertain'
    ? stanceRaw
    : 'uncertain';
  const focusPoints = Array.isArray(row.focusPoints) ? row.focusPoints.map(toText).filter(Boolean) : [];
  const uncertainties = Array.isArray(row.uncertainties) ? row.uncertainties.map(toText).filter(Boolean) : [];

  return {
    brainType,
    stance,
    reason,
    focusPoints: focusPoints.length > 0 ? focusPoints : ['信息不足'],
    uncertainties: uncertainties.length > 0 ? uncertainties : [reason],
    unavailable: typeof row.unavailable === 'boolean' ? row.unavailable : false,
  };
};

const toAnalyses = (value: unknown): DecisionDraft['analyses'] => {
  const rows = (Array.isArray(value) ? value : []) as Array<Record<string, unknown>>;
  const mapByBrain = new Map<BrainType, Record<string, unknown>>();

  rows.forEach((item) => {
    const brainType = toText(item.brainType) as BrainType;

    if (brainType === 'melchior' || brainType === 'balthasar' || brainType === 'casper') {
      mapByBrain.set(brainType, item);
    }
  });

  if (!Array.isArray(value) && value && typeof value === 'object') {
    const objectValue = value as Record<string, unknown>;
    BRAIN_TYPES.forEach((brainType) => {
      if (objectValue[brainType] && !mapByBrain.has(brainType)) {
        mapByBrain.set(brainType, objectValue[brainType] as Record<string, unknown>);
      }
    });
  }

  return BRAIN_TYPES.map((brainType) => toBrainAnalysis(brainType, mapByBrain.get(brainType)));
};

const toDecisionSummary = (value: unknown, summary: string): DecisionDraft['decisionSummary'] => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    const text = toText(value) || summary || '信息不足';
    return {
      rule: text,
      majorityOpinion: text,
      minorityOpinion: '无',
      missingInformation: [],
      finalDecision: text,
    };
  }

  const row = value as Record<string, unknown>;
  const rule = toText(row.rule) || summary || '信息不足';
  const majorityOpinion = toText(row.majorityOpinion) || toText(row.finalDecision) || summary || '信息不足';
  const minorityOpinion = toText(row.minorityOpinion) || '无';
  const missingInformation = Array.isArray(row.missingInformation) ? row.missingInformation.map(toText).filter(Boolean) : [];
  const finalDecision = toText(row.finalDecision) || summary || majorityOpinion;

  return {
    rule,
    majorityOpinion,
    minorityOpinion,
    missingInformation,
    finalDecision,
  };
};

const normalizeDecisionDraft = (
  raw: unknown,
  userId: string,
  question: string,
): DecisionDraft => {
  const row = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const summary = toText(row.summary) || toText(row.decisionSummary) || '信息不足';

  return {
    userId,
    question,
    questionType: toQuestionType(row.questionType),
    finalStatus: normalizeStatus(toText(row.finalStatus)),
    summary,
    confidence: toConfidence(row.confidence),
    variables: toVariables(row.variables),
    analyses: toAnalyses(row.analyses),
    decisionSummary: toDecisionSummary(row.decisionSummary, summary),
  };
};

export const createRefusedDecision = (
  userId: string,
  question: string,
  reason: string,
): DecisionDraft => ({
  // 统一降级出口：LLM 超时、格式错误、调用失败都落到拒绝裁决。
  userId,
  question,
  questionType: 'strategy',
  finalStatus: 'refused',
  summary: reason,
  confidence: 0,
  variables: [
    {
      name: '关键变量',
      value: '',
      isMissing: true,
      isCritical: true,
    },
  ],
  analyses: [
    {
      brainType: 'melchior',
      stance: 'uncertain',
      reason,
      focusPoints: ['逻辑条件不足'],
      uncertainties: [reason],
      unavailable: true,
    },
    {
      brainType: 'balthasar',
      stance: 'uncertain',
      reason,
      focusPoints: ['人因条件不足'],
      uncertainties: [reason],
      unavailable: true,
    },
    {
      brainType: 'casper',
      stance: 'uncertain',
      reason,
      focusPoints: ['经验样本不足'],
      uncertainties: [reason],
      unavailable: true,
    },
  ],
  decisionSummary: {
    rule: '关键变量缺失或系统不可用',
    majorityOpinion: '无法形成多数意见',
    minorityOpinion: '无',
    missingInformation: [reason],
    finalDecision: reason,
  },
});

const normalizeStatus = (status: string): FinalStatus => {
  // 模型返回非白名单状态时不做猜测，直接按拒绝裁决处理。
  if (status === 'approved' || status === 'rejected' || status === 'deferred' || status === 'refused') {
    return status;
  }

  return 'refused';
};

const createDecisionUnavailableError = (cause?: unknown): AppError => {
  const error = new Error('DECISION_SERVICE_UNAVAILABLE', cause === undefined ? undefined : { cause }) as AppError;
  error.statusCode = 503;

  return error;
};

const isLlmServiceError = (error: unknown): boolean => {
  if (error instanceof z.ZodError) {
    return true;
  }

  if (!(error instanceof Error)) {
    return false;
  }

  if (error.name === 'AbortError') {
    return true;
  }

  return (
    error.message.startsWith('LLM_')
    || error.message === 'DECISION_SERVICE_UNAVAILABLE'
  );
};

export const orchestrateDecision = async (
  input: OrchestrateDecisionInput,
): Promise<DecisionDraft> => decisionLimit(async (): Promise<DecisionDraft> => {
  try {
    // decisionLimit 控制完整裁决并发，llmLimiter 控制实际 LLM 请求频率。
    const draft = await llmLimiter.schedule(() => requestLlmJson<DecisionDraft>(
      input.config,
      [
        {
          role: 'system',
          content: [
            '你是 Magi Core，只执行一次裁决，不进行聊天。',
            '必须返回严格 JSON，不要 Markdown。',
            '字段必须包含 userId、question、questionType、finalStatus、summary、confidence、variables、analyses、decisionSummary。',
            'finalStatus 只能是 approved、rejected、deferred、refused。',
            'analyses 必须分别包含 melchior、balthasar、casper。',
            '关键信息不足时必须返回 refused。',
          ].join('\n'),
        },
        {
          role: 'user',
          content: JSON.stringify({ userId: input.userId, question: input.question }),
        },
      ],
      25000,
    ));

    // 服务端重新覆盖 userId/question，防止模型回写不可信字段污染持久化数据。
    return decisionDraftSchema.parse(normalizeDecisionDraft(draft, input.userId, input.question));
  } catch (error) {
    if (isLlmServiceError(error)) {
      throw createDecisionUnavailableError(error);
    }

    throw error;
  }
});
