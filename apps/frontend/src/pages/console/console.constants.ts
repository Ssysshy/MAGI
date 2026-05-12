import type { BrainAnalysis, BrainStance, BrainType, DecisionSession, FinalStatus, QuestionType } from '@magi/shared';
import type { BrainAnalysisMeta } from './console.types';

export const BRAIN_ORDER: Record<BrainType, number> = {
  melchior: 1,
  balthasar: 2,
  casper: 3,
};

export const BRAIN_STANCE_TEXT: Record<BrainStance, string> = {
  approve: '认可',
  reject: '否决',
  defer: '延后',
  uncertain: '待定',
};

export const FINAL_STATUS_TEXT: Record<FinalStatus, string> = {
  approved: '认可',
  rejected: '否决',
  deferred: '延后',
  refused: '拒绝裁决',
};

export const GRAPH_FINAL_STATUS_TEXT: Record<FinalStatus, string> = {
  approved: '认可',
  rejected: '否决',
  deferred: '延后',
  refused: '拒绝',
};

export const QUESTION_TYPE_TEXT: Record<QuestionType, string> = {
  boolean: '是非决策',
  multiple_choice: '多选决策',
  priority: '优先级决策',
  strategy: '策略决策',
  diagnosis: '诊断决策',
};

export const BRAIN_ANALYSIS_META: Record<BrainType, BrainAnalysisMeta> = {
  melchior: {
    title: 'MELCHIOR · 1',
    role: '科学家（逻辑/效率）',
  },
  balthasar: {
    title: 'BALTHASAR · 2',
    role: '母亲（情绪/关系）',
  },
  casper: {
    title: 'CASPER · 3',
    role: '智者（经验/现实）',
  },
};

export const DEFAULT_ANALYSES: BrainAnalysis[] = [
  {
    brainType: 'melchior',
    questionType: 'strategy',
    variables: [],
    status: 'pending',
    stance: 'uncertain',
    reason: '等待 Melchior 接入',
    focusPoints: ['等待裁决启动'],
    uncertainties: ['尚未开始分析'],
  },
  {
    brainType: 'balthasar',
    questionType: 'strategy',
    variables: [],
    status: 'pending',
    stance: 'uncertain',
    reason: '等待 Balthasar 接入',
    focusPoints: ['等待裁决启动'],
    uncertainties: ['尚未开始分析'],
  },
  {
    brainType: 'casper',
    questionType: 'strategy',
    variables: [],
    status: 'pending',
    stance: 'uncertain',
    reason: '等待 Casper 接入',
    focusPoints: ['等待裁决启动'],
    uncertainties: ['尚未开始分析'],
  },
];

export const DEFAULT_DECISION: DecisionSession = {
  id: '473',
  userId: 'preview',
  question: '',
  questionType: 'strategy',
  processingStage: 'queued',
  processingStatus: 'pending',
  finalStatus: 'refused',
  summary: '等待输入议题后开始本次裁决',
  confidence: 0,
  variables: [],
  analyses: DEFAULT_ANALYSES,
  decisionSummary: {
    rule: '等待主控汇总',
    majorityOpinion: '等待裁决开始',
    minorityOpinion: '无',
    missingInformation: [],
    finalDecision: '等待裁决开始',
  },
  createdAt: new Date().toISOString(),
};

// 视觉稿只展示 3 位裁决编号，真实 id 统一在展示层截取。
export const getDecisionCode = (id: string): string => id.slice(-3).toUpperCase();
