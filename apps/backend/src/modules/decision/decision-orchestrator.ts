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

export const createRefusedDecision = (
  userId: string,
  question: string,
  reason: string,
): DecisionDraft => ({
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
  if (status === 'approved' || status === 'rejected' || status === 'deferred' || status === 'refused') {
    return status;
  }

  return 'refused';
};

export const orchestrateDecision = async (
  input: OrchestrateDecisionInput,
): Promise<DecisionDraft> => decisionLimit(async (): Promise<DecisionDraft> => {
  try {
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

    return decisionDraftSchema.parse({
      ...draft,
      userId: input.userId,
      question: input.question,
      finalStatus: normalizeStatus(draft.finalStatus),
    });
  } catch {
    return createRefusedDecision(input.userId, input.question, 'LLM 调用失败，系统拒绝裁决。');
  }
});
