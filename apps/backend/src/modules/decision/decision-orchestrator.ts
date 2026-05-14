import Bottleneck from 'bottleneck';
import pLimit from 'p-limit';
import { z } from 'zod';
import type {
  BrainAnalysis,
  BrainType,
  DecisionSession,
  DecisionSummary,
  DecisionVariable,
  FinalStatus,
  QuestionType,
} from '@magi/shared';
import { env } from '../../config/env.js';
import { requestLlmJson, type LlmConfig } from './llm-client.js';

const decisionLimit = pLimit(5);
const llmLimiter = new Bottleneck({
  minTime: 500,
  maxConcurrent: 3,
});
const DECISION_LLM_TIMEOUT_MS = env.DECISION_LLM_TIMEOUT_MS;
const MELCHIOR_LLM_TIMEOUT_MS = env.MELCHIOR_TIMEOUT_MS ?? env.DECISION_LLM_TIMEOUT_MS;

const questionTypeSchema = z.enum(['boolean', 'multiple_choice', 'priority', 'strategy', 'diagnosis']);
const finalStatusSchema = z.enum(['approved', 'rejected', 'deferred', 'refused']);
const brainStanceSchema = z.enum(['approve', 'reject', 'defer', 'uncertain']);

const coreDecisionSchema = z.object({
  finalStatus: finalStatusSchema,
  summary: z.string(),
  confidence: z.number().min(0).max(1),
  decisionSummary: z.object({
    rule: z.string(),
    majorityOpinion: z.string(),
    minorityOpinion: z.string(),
    missingInformation: z.array(z.string()),
    finalDecision: z.string(),
  }),
});

type DecisionDraft = Omit<DecisionSession, 'id' | 'createdAt'>;
type AppError = Error & { statusCode: number };

export interface DecisionContext {
  questionType: QuestionType;
  variables: DecisionVariable[];
  missingInformation: string[];
}

const BRAIN_TYPES: BrainType[] = ['melchior', 'balthasar', 'casper'];
const BRAIN_ROLES: Record<BrainType, string> = {
  melchior: '科学家（逻辑、效率、条件完备性）',
  balthasar: '母亲（情绪、关系、承受度）',
  casper: '智者（经验、现实、可执行性）',
};
const REJECT_STANCE_RE = /(绝不能|不能闯|禁止|违法|违规|严重|高风险|不可执行|不应|不能做|否决|危险|危害|不合理)/;
const APPROVE_STANCE_RE = /(可以执行|建议通过|推荐执行|支持执行|认可|可行)/;
const DEFER_STANCE_RE = /(延后|暂缓|等待|条件不足|时机未到|暂不建议)/;
const OBVIOUS_RISK_QUESTION_RE = /(红灯|闯红灯|酒驾|吸毒驾驶|撞人|伤害|暴力|非法|违法|犯罪|自杀|毒品|纵火|抢劫)/;
const FIELD_DEGRADE_FOCUS_POINT = '字段级降级路径';
const RULE_DEGRADE_FOCUS_POINT = '规则直判降级路径';
const ANALYSIS_REASON_KEYS = ['reason', 'summary', 'recommendation', 'conclusion', 'advice', 'opinion', 'judgment', 'judgement', 'decision', 'analysis'];
const ANALYSIS_FOCUS_KEYS = ['focusPoints', 'keyPoints', 'points', 'highlights', 'considerations'];
const ANALYSIS_UNCERTAINTY_KEYS = ['uncertainties', 'missingInformation', 'unknowns', 'assumptions', 'dependencies', 'risks'];
const CORE_RULE_KEYS = ['rule', 'principle', 'policy', 'basis'];
const CORE_MAJORITY_KEYS = ['majorityOpinion', 'majority', 'consensus', 'summary'];
const CORE_MINORITY_KEYS = ['minorityOpinion', 'minority', 'dissent', 'counterpoint'];
const CORE_FINAL_DECISION_KEYS = ['finalDecision', 'decision', 'recommendation', 'conclusion', 'summary'];
const CORE_MISSING_INFO_KEYS = ['missingInformation', 'missingInfo', 'uncertainties', 'unknowns', 'dependencies'];

const getDefaultVariablesForQuestion = (question: string): DecisionVariable[] => {
  if (OBVIOUS_RISK_QUESTION_RE.test(question)) {
    return [
      {
        name: '法律规则明确性',
        value: '明确禁止',
        isMissing: false,
        isCritical: false,
      },
      {
        name: '人身安全风险',
        value: '高',
        isMissing: false,
        isCritical: false,
      },
      {
        name: '是否存在紧急法定例外',
        value: '',
        isMissing: true,
        isCritical: false,
      },
    ];
  }

  return [];
};

const toText = (value: unknown): string => {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return '';
};

const toRecord = (value: unknown): Record<string, unknown> => (
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
);

const normalizeLookupKey = (value: string): string => value
  .trim()
  .toLowerCase()
  .replace(/[\s_-]+/g, '')
  .replace(/[()（）]/g, '');

const mergeUniqueTexts = (...groups: string[][]): string[] => {
  const seen = new Set<string>();
  const merged: string[] = [];

  for (const group of groups) {
    for (const item of group) {
      const text = toText(item);

      if (!text || seen.has(text)) {
        continue;
      }

      seen.add(text);
      merged.push(text);
    }
  }

  return merged;
};

const toStringArray = (value: unknown): string[] => (
  Array.isArray(value) ? value.map(toText).filter(Boolean) : []
);

const QUESTION_TYPE_ALIASES: Record<string, QuestionType> = {
  boolean: 'boolean',
  yesno: 'boolean',
  truefalse: 'boolean',
  是非判断: 'boolean',
  判断题: 'boolean',
  singlechoice: 'multiple_choice',
  multiplechoice: 'multiple_choice',
  choice: 'multiple_choice',
  option: 'multiple_choice',
  选项: 'multiple_choice',
  选择题: 'multiple_choice',
  priority: 'priority',
  priorityranking: 'priority',
  ranking: 'priority',
  优先级: 'priority',
  排序: 'priority',
  strategy: 'strategy',
  strategic: 'strategy',
  projectdecision: 'strategy',
  projectmanagement: 'strategy',
  solutionselection: 'strategy',
  planselection: 'strategy',
  strategylike: 'strategy',
  决策: 'strategy',
  项目决策: 'strategy',
  项目管理: 'strategy',
  方案选择: 'strategy',
  技术方案: 'strategy',
  策略: 'strategy',
  诊断: 'diagnosis',
  diagnosis: 'diagnosis',
  diagnostic: 'diagnosis',
};

const resolveQuestionType = (value: unknown): { questionType: QuestionType; degraded: boolean; raw: string } => {
  const raw = toText(value);

  if (!raw) {
    return {
      questionType: 'strategy',
      degraded: true,
      raw,
    };
  }

  if (questionTypeSchema.safeParse(raw).success) {
    return {
      questionType: raw as QuestionType,
      degraded: false,
      raw,
    };
  }

  const alias = QUESTION_TYPE_ALIASES[normalizeLookupKey(raw)];

  if (alias) {
    return {
      questionType: alias,
      degraded: false,
      raw,
    };
  }

  return {
    questionType: 'strategy',
    degraded: true,
    raw,
  };
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

const toVariables = (value: unknown): DecisionVariable[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item): DecisionVariable | null => {
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
    .filter((item): item is DecisionVariable => item !== null);
};

const extractFirstTextByKeys = (row: Record<string, unknown>, keys: string[]): string => {
  for (const key of keys) {
    const text = toText(row[key]);

    if (text) {
      return text;
    }
  }

  return '';
};

const extractFirstArrayByKeys = (row: Record<string, unknown>, keys: string[]): string[] => {
  for (const key of keys) {
    const values = toStringArray(row[key]);

    if (values.length > 0) {
      return values;
    }
  }

  return [];
};

const toAnalysisPreview = (value: unknown): string => {
  if (typeof value === 'string') {
    return value.slice(0, 160);
  }

  if (value && typeof value === 'object') {
    const json = JSON.stringify(value);
    return json.length > 160 ? `${json.slice(0, 160)}...` : json;
  }

  return toText(value).slice(0, 160);
};

interface NormalizedAnalysisInput {
  normalized: unknown;
  hasSignal: boolean;
  issues: string[];
  valueType: string;
  preview: string;
}

const normalizeAnalysisInput = (value: unknown): NormalizedAnalysisInput => {
  if (typeof value === 'string') {
    const reason = toText(value);

    return {
      normalized: reason ? { reason } : {},
      hasSignal: reason.length > 0,
      issues: reason.length > 0
        ? ['analysis.focusPoints 缺失，已使用默认值', 'analysis.uncertainties 缺失，已使用默认值']
        : ['analysis.reason 缺失，已使用默认值', 'analysis.focusPoints 缺失，已使用默认值', 'analysis.uncertainties 缺失，已使用默认值'],
      valueType: 'string',
      preview: toAnalysisPreview(value),
    };
  }

  const row = toRecord(value);
  const stanceRaw = toText(row.stance);
  const reason = extractFirstTextByKeys(row, ANALYSIS_REASON_KEYS);
  const focusPoints = extractFirstArrayByKeys(row, ANALYSIS_FOCUS_KEYS);
  const uncertainties = extractFirstArrayByKeys(row, ANALYSIS_UNCERTAINTY_KEYS);
  const hasValidStance = brainStanceSchema.safeParse(stanceRaw).success;
  const issues: string[] = [];

  if (stanceRaw && !hasValidStance) {
    issues.push('analysis.stance 非法，已按文本语义推断');
  }

  if (!reason) {
    issues.push('analysis.reason 缺失，已使用默认值');
  }

  if (focusPoints.length === 0) {
    issues.push('analysis.focusPoints 缺失，已使用默认值');
  }

  if (uncertainties.length === 0) {
    issues.push('analysis.uncertainties 缺失，已使用默认值');
  }

  return {
    normalized: {
      ...(hasValidStance ? { stance: stanceRaw } : {}),
      ...(reason ? { reason } : {}),
      ...(focusPoints.length > 0 ? { focusPoints } : {}),
      ...(uncertainties.length > 0 ? { uncertainties } : {}),
    },
    hasSignal: hasValidStance || reason.length > 0 || focusPoints.length > 0 || uncertainties.length > 0,
    issues,
    valueType: Array.isArray(value) ? 'array' : typeof value,
    preview: toAnalysisPreview(value),
  };
};

const logPartialSchema = (
  brainType: BrainType,
  issues: string[],
  value: unknown,
  diagnostics?: { rawQuestionType?: string; analysisValueType?: string; analysisPreview?: string },
): void => {
  if (issues.length === 0) {
    return;
  }

  const row = toRecord(value);

  console.warn('[decision.brain.partial]', {
    brainType,
    errorCode: 'LLM_SCHEMA_PARTIAL_INVALID',
    issues,
    resultType: Array.isArray(value) ? 'array' : typeof value,
    topLevelKeys: Object.keys(row).slice(0, 12),
    rawQuestionType: diagnostics?.rawQuestionType ?? null,
    analysisValueType: diagnostics?.analysisValueType ?? null,
    analysisPreview: diagnostics?.analysisPreview ?? null,
  });
};

const inferBrainStance = (reason: string, focusPoints: string[]): BrainAnalysis['stance'] => {
  const combinedText = [reason, ...focusPoints].join(' ');

  if (REJECT_STANCE_RE.test(combinedText)) {
    return 'reject';
  }

  if (DEFER_STANCE_RE.test(combinedText)) {
    return 'defer';
  }

  if (APPROVE_STANCE_RE.test(combinedText)) {
    return 'approve';
  }

  return 'uncertain';
};

const toDecisionSummary = (value: unknown, summary: string): DecisionSummary => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {
      rule: summary,
      majorityOpinion: summary,
      minorityOpinion: '无',
      missingInformation: [],
      finalDecision: summary,
    };
  }

  const row = value as Record<string, unknown>;

  return {
    rule: toText(row.rule) || summary,
    majorityOpinion: toText(row.majorityOpinion) || summary,
    minorityOpinion: toText(row.minorityOpinion) || '无',
    missingInformation: Array.isArray(row.missingInformation) ? row.missingInformation.map(toText).filter(Boolean) : [],
    finalDecision: toText(row.finalDecision) || summary,
  };
};

const normalizeCoreDecisionSummary = (
  value: unknown,
  summary: string,
): { summary: DecisionSummary; issues: string[]; valueType: string; preview: string } => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    const summaryText = toText(value) || summary;
    const issues = summaryText
      ? ['decisionSummary 非标准对象，已按 summary 自动补齐']
      : ['decisionSummary 缺失，已按 summary 自动补齐'];

    return {
      summary: {
        rule: summary,
        majorityOpinion: summary,
        minorityOpinion: '无',
        missingInformation: [],
        finalDecision: summaryText || summary,
      },
      issues,
      valueType: Array.isArray(value) ? 'array' : typeof value,
      preview: toAnalysisPreview(value),
    };
  }

  const row = toRecord(value);
  const rule = extractFirstTextByKeys(row, CORE_RULE_KEYS) || summary;
  const majorityOpinion = extractFirstTextByKeys(row, CORE_MAJORITY_KEYS) || summary;
  const minorityOpinion = extractFirstTextByKeys(row, CORE_MINORITY_KEYS) || '无';
  const finalDecision = extractFirstTextByKeys(row, CORE_FINAL_DECISION_KEYS) || summary;
  const missingInformation = extractFirstArrayByKeys(row, CORE_MISSING_INFO_KEYS);
  const issues: string[] = [];

  if (!toText(row.rule) && rule === summary) {
    issues.push('decisionSummary.rule 缺失，已按 summary 自动补齐');
  }

  if (!toText(row.majorityOpinion) && majorityOpinion === summary) {
    issues.push('decisionSummary.majorityOpinion 缺失，已按 summary 自动补齐');
  }

  if (!toText(row.finalDecision) && finalDecision === summary) {
    issues.push('decisionSummary.finalDecision 缺失，已按 summary 自动补齐');
  }

  if (!Array.isArray(row.missingInformation) && missingInformation.length === 0) {
    issues.push('decisionSummary.missingInformation 缺失，已回退为空数组');
  }

  return {
    summary: {
      rule,
      majorityOpinion,
      minorityOpinion,
      missingInformation,
      finalDecision,
    },
    issues,
    valueType: typeof value,
    preview: toAnalysisPreview(value),
  };
};

const normalizeCoreDecision = (
  result: unknown,
): {
  finalStatus: FinalStatus;
  summary: string;
  confidence: number;
  decisionSummary: DecisionSummary;
  issues: string[];
} => {
  const row = toRecord(result);
  const finalStatus = toFinalStatus(row.finalStatus);
  const summary = toText(row.summary) || extractFirstTextByKeys(row, ['decision', 'recommendation', 'conclusion']) || '信息不足';
  const confidence = toConfidence(row.confidence);
  const decisionSummaryResult = normalizeCoreDecisionSummary(row.decisionSummary, summary);
  const issues = [...decisionSummaryResult.issues];

  if (!toText(row.finalStatus)) {
    issues.push('finalStatus 缺失，已回退为 refused');
  }

  if (!toText(row.summary)) {
    issues.push(summary === '信息不足' ? 'summary 缺失，已使用默认值' : 'summary 缺失，已从别名字段提取');
  }

  return {
    finalStatus,
    summary,
    confidence,
    decisionSummary: decisionSummaryResult.summary,
    issues,
  };
};

const toFinalStatus = (value: unknown): FinalStatus => {
  const raw = toText(value);

  if (raw === 'approved' || raw === 'rejected' || raw === 'deferred' || raw === 'refused') {
    return raw;
  }

  return 'refused';
};

const normalizeBrainAnalysis = (
  brainType: BrainType,
  value: unknown,
  status: BrainAnalysis['status'],
  context?: Pick<DecisionContext, 'questionType' | 'variables'>,
): BrainAnalysis => {
  const row = toRecord(value);
  const questionType = context?.questionType ?? resolveQuestionType(row.questionType).questionType;
  const variables = context?.variables ?? toVariables(row.variables);
  const stanceRaw = toText(row.stance);
  const reason = toText(row.reason) || toText(row.analysis) || '信息不足';
  const focusPoints = toStringArray(row.focusPoints);
  const stance = stanceRaw === 'approve' || stanceRaw === 'reject' || stanceRaw === 'defer' || stanceRaw === 'uncertain'
    ? stanceRaw
    : inferBrainStance(reason, focusPoints);
  const uncertainties = toStringArray(row.uncertainties);

  return {
    brainType,
    questionType,
    variables,
    status,
    stance,
    reason,
    focusPoints: focusPoints.length > 0 ? focusPoints : ['信息不足'],
    uncertainties: uncertainties.length > 0 ? uncertainties : [reason],
    unavailable: typeof row.unavailable === 'boolean' ? row.unavailable : false,
  };
};

const enrichBrainAnalysis = (
  brainType: BrainType,
  analysis: BrainAnalysis,
  issues: string[],
  options?: { includeRuleDegrade?: boolean },
): BrainAnalysis => {
  if (issues.length === 0) {
    return analysis;
  }

  const focusPoints = mergeUniqueTexts(
    options?.includeRuleDegrade ? [RULE_DEGRADE_FOCUS_POINT, FIELD_DEGRADE_FOCUS_POINT] : [FIELD_DEGRADE_FOCUS_POINT],
    analysis.focusPoints,
  );
  const uncertainties = mergeUniqueTexts(issues, analysis.uncertainties);
  const reason = analysis.reason === '信息不足'
    ? `${issues[0]}，已按降级策略继续裁决`
    : analysis.reason;

  return {
    ...analysis,
    brainType,
    reason,
    focusPoints,
    uncertainties,
    unavailable: false,
  };
};

const createPendingAnalysis = (
  brainType: BrainType,
  context?: Pick<DecisionContext, 'questionType' | 'variables'>,
): BrainAnalysis => ({
  brainType,
  questionType: context?.questionType ?? 'strategy',
  variables: context?.variables ?? [],
  status: 'pending',
  stance: 'uncertain',
  reason: `等待 ${brainType.toUpperCase()} 接入`,
  focusPoints: ['等待裁决启动'],
  uncertainties: ['尚未开始分析'],
  unavailable: false,
});

const createFailedAnalysis = (
  brainType: BrainType,
  reason: string,
  context?: Pick<DecisionContext, 'questionType' | 'variables'>,
): BrainAnalysis => ({
  brainType,
  questionType: context?.questionType ?? 'strategy',
  variables: context?.variables ?? [],
  status: 'failed',
  stance: 'uncertain',
  reason,
  focusPoints: ['裁决链路降级'],
  uncertainties: [reason],
  unavailable: true,
});

export const createPendingAnalyses = (
  context?: Pick<DecisionContext, 'questionType' | 'variables'>,
): BrainAnalysis[] => BRAIN_TYPES.map((brainType) => createPendingAnalysis(brainType, context));

export const createPlaceholderDecisionSummary = (summary: string): DecisionSummary => ({
  rule: '等待主控汇总',
  majorityOpinion: summary,
  minorityOpinion: '无',
  missingInformation: [],
  finalDecision: summary,
});

export const createFailedDecisionSummary = (reason: string, stage: string): DecisionSummary => ({
  rule: '裁决链路失败',
  majorityOpinion: '本次未形成有效多数意见（阶段失败）',
  minorityOpinion: '无',
  missingInformation: [stage],
  finalDecision: reason,
});

export const createPendingDecision = (
  userId: string,
  question: string,
): DecisionDraft => ({
  userId,
  question,
  questionType: 'strategy',
  processingStage: 'queued',
  processingStatus: 'running',
  finalStatus: 'refused',
  summary: '等待裁决完成',
  confidence: 0,
  variables: [],
  analyses: createPendingAnalyses(),
  decisionSummary: createPlaceholderDecisionSummary('等待输入议题后开始本次裁决'),
});

export const createRefusedDecision = (
  userId: string,
  question: string,
  reason: string,
  variables: DecisionVariable[] = [],
  analyses: BrainAnalysis[] = createPendingAnalyses(),
): DecisionDraft => ({
  userId,
  question,
  questionType: 'strategy',
  processingStage: 'completed',
  processingStatus: 'completed',
  finalStatus: 'refused',
  summary: reason,
  confidence: 0,
  variables,
  analyses,
  decisionSummary: {
    rule: '关键变量缺失或系统不可用',
    majorityOpinion: '主控未形成通过结论',
    minorityOpinion: '无',
    missingInformation: variables
      .filter((item: DecisionVariable): boolean => item.isMissing)
      .map((item: DecisionVariable): string => item.name),
    finalDecision: reason,
  },
});

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

  return error.message.startsWith('LLM_') || error.message === 'DECISION_SERVICE_UNAVAILABLE';
};

const requestDecisionJson = async <T>(
  config: LlmConfig,
  messages: Array<{ role: 'system' | 'user'; content: string }>,
  options?: { brainType?: 'context' | 'melchior' | 'balthasar' | 'casper' | 'core'; timeoutMs?: number },
): Promise<T> => {
  let lastError: unknown;
  const timeoutMs = options?.timeoutMs ?? DECISION_LLM_TIMEOUT_MS;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await llmLimiter.schedule(() => requestLlmJson<T>(config, messages, timeoutMs, {
        brainType: options?.brainType ?? 'unknown',
        attempts: 1,
        onAttemptDone: (context): void => {
          const payload = {
            brainType: context.brainType,
            attempt: attempt + 1,
            durationMs: context.durationMs,
            timeoutMs: context.timeoutMs,
            httpStatus: context.httpStatus,
            errorCode: context.errorCode,
            model: context.model,
            baseUrlHost: context.baseUrlHost,
            responseFormatType: context.responseFormatType,
            contentPreview: context.contentPreview,
            contentLength: context.contentLength,
          };

          if (context.errorCode) {
            console.warn('[decision.llm.attempt]', payload);
            return;
          }

          console.info('[decision.llm.attempt]', payload);
        },
      }));
    } catch (error) {
      lastError = error;

      if (!isLlmServiceError(error) || attempt === 1) {
        throw error;
      }
    }
  }

  if (isHardLlmError(lastError)) {
    throw createDecisionUnavailableError(lastError);
  }

  throw lastError ?? createDecisionUnavailableError();
};

interface BrainDecisionInput {
  question: string;
  questionType: QuestionType;
  variables: DecisionVariable[];
  config: LlmConfig;
}

type MelchiorMode = 'strict' | 'relaxed';

const normalizeDecisionContext = (question: string, result: unknown): DecisionContext => {
  const row = toRecord(result);
  const fallbackVariables = getDefaultVariablesForQuestion(question);
  const questionTypeResult = resolveQuestionType(row.questionType);
  const variables = toVariables(row.variables);
  const finalVariables = variables.length > 0 ? variables : fallbackVariables;
  const missingInformation = mergeUniqueTexts(
    toStringArray(row.missingInformation),
    finalVariables
      .filter((item: DecisionVariable): boolean => item.isMissing)
      .map((item: DecisionVariable): string => item.name),
  );
  const issues: string[] = [];

  if (questionTypeResult.degraded) {
    issues.push('questionType 非法，已回退为 strategy');
  }

  if (!Array.isArray(row.variables) || variables.length === 0) {
    issues.push(
      fallbackVariables.length > 0
        ? 'variables 缺失或无有效项，已使用默认变量'
        : 'variables 缺失或无有效项，已回退为空数组',
    );
  }

  logPartialSchema('melchior', issues, result, {
    rawQuestionType: questionTypeResult.raw,
  });

  return {
    questionType: questionTypeResult.questionType,
    variables: finalVariables,
    missingInformation,
  };
};

const buildBrainAnalysis = (
  brainType: BrainType,
  result: unknown,
  context: Pick<DecisionContext, 'questionType' | 'variables'>,
  options?: { allowRuleDegrade?: boolean },
): BrainAnalysis => {
  const normalizedAnalysisInput = normalizeAnalysisInput(result);
  const issues = [...normalizedAnalysisInput.issues];

  logPartialSchema(brainType, issues, result, {
    analysisValueType: normalizedAnalysisInput.valueType,
    analysisPreview: normalizedAnalysisInput.preview,
  });

  const normalizedAnalysis = normalizeBrainAnalysis(brainType, normalizedAnalysisInput.normalized, 'completed', context);
  const finalAnalysisBase = options?.allowRuleDegrade && !normalizedAnalysisInput.hasSignal && context.variables.length > 0
    ? {
        brainType,
        questionType: context.questionType,
        variables: context.variables,
        status: 'completed' as const,
        stance: 'reject' as const,
        reason: '模型返回结构不完整，已按规则直判降级处理',
        focusPoints: [RULE_DEGRADE_FOCUS_POINT, '采用默认规则变量继续裁决'],
        uncertainties: issues.length > 0 ? issues : ['模型返回结构不完整'],
        unavailable: false,
      }
    : normalizedAnalysis;
  const finalAnalysis = enrichBrainAnalysis(brainType, finalAnalysisBase, issues, {
    includeRuleDegrade: options?.allowRuleDegrade,
  });

  if (!normalizedAnalysisInput.hasSignal && (!options?.allowRuleDegrade || context.variables.length === 0)) {
    throw new Error('LLM_SCHEMA_PARTIAL_INVALID');
  }

  return finalAnalysis;
};

const getLlmHttpStatus = (error: unknown): number | null => {
  if (!(error instanceof Error)) {
    return null;
  }

  const matched = error.message.match(/^LLM_HTTP_(\d{3})$/);

  if (!matched) {
    return null;
  }

  const status = Number.parseInt(matched[1], 10);

  return Number.isNaN(status) ? null : status;
};

const isHardLlmError = (error: unknown): boolean => {
  if (!(error instanceof Error)) {
    return false;
  }

  if (error.name === 'AbortError') {
    return true;
  }

  const status = getLlmHttpStatus(error);

  return status === 401 || status === 403 || status === 429 || (typeof status === 'number' && status >= 500);
};

export const classifyMelchiorMode = (question: string): MelchiorMode => (
  isObviousRiskQuestion(question) ? 'relaxed' : 'strict'
);

export const deriveDecisionContext = async (
  input: Pick<BrainDecisionInput, 'question' | 'config'>,
): Promise<DecisionContext> => decisionLimit(async (): Promise<DecisionContext> => {
  try {
    const result = await requestDecisionJson<unknown>(input.config, [
      {
        role: 'system',
        content: [
          '你是 Magi 的问题识别单元，只负责统一裁决上下文。',
          '必须返回严格 JSON，不要 Markdown。',
          '字段必须包含 questionType、variables、missingInformation。',
          'questionType 只能是 boolean、multiple_choice、priority、strategy、diagnosis。',
          'variables 每项包含 name、value、isMissing、isCritical。',
          'missingInformation 只列出会影响裁决质量的缺失信息。',
          '如果问题属于公共规则或基础安全判断，可以直接返回通用默认变量，不允许为了边缘情境把常识变量标记为关键缺失。',
          '只有当某变量缺失会直接阻断裁决，且没有合理默认假设可以替代时，才允许标记 isCritical=true。',
        ].join('\n'),
      },
      {
        role: 'user',
        content: JSON.stringify({ question: input.question }),
      },
    ], {
      brainType: 'context',
      timeoutMs: MELCHIOR_LLM_TIMEOUT_MS,
    });

    return normalizeDecisionContext(input.question, result);
  } catch (error) {
    if (isLlmServiceError(error)) {
      throw createDecisionUnavailableError(error);
    }

    throw error;
  }
});

export const analyzeWithMelchior = async (
  input: BrainDecisionInput,
): Promise<BrainAnalysis> => decisionLimit(async (): Promise<BrainAnalysis> => {
  const mode = classifyMelchiorMode(input.question);

  try {
    const result = await requestDecisionJson<unknown>(input.config, [
      {
        role: 'system',
        content: [
          '你是 Magi 的 Melchior，只负责逻辑、效率和条件完备性判断。',
          '必须返回严格 JSON，不要 Markdown。',
          '字段必须包含 stance、reason、focusPoints、uncertainties。',
          '只能基于输入里的统一 questionType 和 variables 分析，不要重新定义题型或变量。',
          '只输出当前角色的独立判断，不要汇总最终裁决。',
        ].join('\n'),
      },
      {
        role: 'user',
        content: JSON.stringify({
          question: input.question,
          questionType: input.questionType,
          variables: input.variables,
        }),
      },
    ], {
      brainType: 'melchior',
      timeoutMs: MELCHIOR_LLM_TIMEOUT_MS,
    });
    return buildBrainAnalysis('melchior', result, {
      questionType: input.questionType,
      variables: input.variables,
    }, {
      allowRuleDegrade: mode === 'relaxed',
    });
  } catch (error) {
    if (isLlmServiceError(error)) {
      throw createDecisionUnavailableError(error);
    }

    throw error;
  }
});

export const analyzeWithBrain = async (
  brainType: Exclude<BrainType, 'melchior'>,
  input: BrainDecisionInput,
): Promise<BrainAnalysis> => decisionLimit(async (): Promise<BrainAnalysis> => {
  try {
    const result = await requestDecisionJson<unknown>(input.config, [
      {
        role: 'system',
        content: [
          `你是 Magi 的 ${brainType.toUpperCase()}，职责是 ${BRAIN_ROLES[brainType]}。`,
          '必须返回严格 JSON，不要 Markdown。',
          '字段必须包含 stance、reason、focusPoints、uncertainties。',
          '只能基于输入里的统一 questionType 和 variables 分析，不要重新定义题型或变量。',
          '如果你的理由已经明确支持或反对，stance 必须同步返回 approve 或 reject，不要保守地返回 uncertain。',
          '只输出当前角色的独立判断，不要汇总最终裁决。',
        ].join('\n'),
      },
      {
        role: 'user',
        content: JSON.stringify({
          question: input.question,
          questionType: input.questionType,
          variables: input.variables,
        }),
      },
    ], {
      brainType,
      timeoutMs: DECISION_LLM_TIMEOUT_MS,
    });

    return buildBrainAnalysis(brainType, result, {
      questionType: input.questionType,
      variables: input.variables,
    });
  } catch (error) {
    if (isLlmServiceError(error)) {
      throw createDecisionUnavailableError(error);
    }

    throw error;
  }
});

interface CoreDecisionInput {
  question: string;
  questionType: QuestionType;
  variables: DecisionVariable[];
  analyses: BrainAnalysis[];
  config: LlmConfig;
}

export const summarizeWithCore = async (
  input: CoreDecisionInput,
): Promise<Pick<DecisionDraft, 'finalStatus' | 'summary' | 'confidence' | 'decisionSummary'>> => decisionLimit(async () => {
  try {
    const result = await requestDecisionJson<unknown>(input.config, [
      {
        role: 'system',
        content: [
          '你是 Magi Core，只负责综合三脑结果输出最终裁决。',
          '必须返回严格 JSON，不要 Markdown。',
          '字段必须包含 finalStatus、summary、confidence、decisionSummary。',
          'finalStatus 只能是 approved、rejected、deferred、refused。',
          'decisionSummary 必须包含 rule、majorityOpinion、minorityOpinion、missingInformation、finalDecision。',
          '对公共规则明确、基础安全风险明确的问题，不要因为缺少边缘情境变量而返回 refused。',
          '若问题本身明显违法、高风险，且已有角色明确反对，应优先返回 rejected。',
          '若关键变量不足或三脑不可用，请返回 refused。',
        ].join('\n'),
      },
      {
        role: 'user',
        content: JSON.stringify({
          question: input.question,
          questionType: input.questionType,
          variables: input.variables,
          analyses: input.analyses,
        }),
      },
    ], {
      brainType: 'core',
      timeoutMs: DECISION_LLM_TIMEOUT_MS,
    });
    const normalized = normalizeCoreDecision(result);
    const raw = toRecord(result);

    if (normalized.issues.length > 0) {
      console.warn('[decision.core.partial]', {
        errorCode: 'LLM_SCHEMA_PARTIAL_INVALID',
        issues: normalized.issues,
        topLevelKeys: Object.keys(raw).slice(0, 12),
        decisionSummaryType: Array.isArray(raw.decisionSummary) ? 'array' : typeof raw.decisionSummary,
        decisionSummaryPreview: toAnalysisPreview(raw.decisionSummary),
      });
    }

    if (!toText(raw.finalStatus) && normalized.summary === '信息不足') {
      throw new Error('LLM_SCHEMA_PARTIAL_INVALID');
    }

    return {
      finalStatus: normalized.finalStatus,
      summary: normalized.summary,
      confidence: normalized.confidence,
      decisionSummary: normalized.decisionSummary,
    };
  } catch (error) {
    if (isLlmServiceError(error)) {
      throw createDecisionUnavailableError(error);
    }

    throw error;
  }
});

export const hasCriticalMissingVariables = (variables: DecisionVariable[]): boolean => variables.some(
  (item: DecisionVariable): boolean => item.isMissing && item.isCritical,
);

export const shouldRefuseForMissingVariables = (variables: DecisionVariable[]): boolean => {
  const criticalMissingVariables = variables.filter(
    (item: DecisionVariable): boolean => item.isMissing && item.isCritical,
  );

  if (criticalMissingVariables.length === 0) {
    return false;
  }

  const filledVariablesCount = variables.filter(
    (item: DecisionVariable): boolean => item.value.trim().length > 0 && !item.isMissing,
  ).length;

  return criticalMissingVariables.length >= 2 || filledVariablesCount === 0;
};

export const isObviousRiskQuestion = (question: string): boolean => OBVIOUS_RISK_QUESTION_RE.test(question);

export const createBrainFailureResult = (
  brainType: BrainType,
  reason: string,
  context?: Pick<DecisionContext, 'questionType' | 'variables'>,
): BrainAnalysis => createFailedAnalysis(brainType, reason, context);

export const mergeBrainAnalyses = (
  analyses: BrainAnalysis[],
): { missingInformation: string[] } => {
  const missingInformation: string[] = [];

  for (const analysis of analyses) {
    if (analysis.status === 'failed') {
      missingInformation.push(`${analysis.brainType.toUpperCase()} 不可用`);
    }

    if (analysis.stance === 'uncertain') {
      missingInformation.push(...analysis.uncertainties);
    }
  }

  return {
    missingInformation: mergeUniqueTexts(missingInformation),
  };
};
