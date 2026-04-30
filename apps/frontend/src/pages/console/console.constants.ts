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
    className: 'analysis-card analysis-red',
  },
  balthasar: {
    title: 'BALTHASAR · 2',
    role: '母亲（情绪/关系）',
    className: 'analysis-card analysis-green',
  },
  casper: {
    title: 'CASPER · 3',
    role: '智者（经验/现实）',
    className: 'analysis-card analysis-green',
  },
};

// 默认数据用于首屏复刻参考图，同时作为未登录/未裁决时的可读初始态。
export const DEFAULT_ANALYSES: BrainAnalysis[] = [
  {
    brainType: 'melchior',
    stance: 'reject',
    reason: '21:58并非传统睡眠时间，但缺乏关键决策变量：身体疲劳程度、次日任务紧迫性、个人睡眠规律等信息。纯逻辑层面无法判断该时间点睡眠对效率最大化的影响，基于信息不完整应持谨慎态度。',
    focusPoints: ['效率', '次日任务', '睡眠规律'],
    uncertainties: ['身体疲劳程度', '次日任务紧迫性'],
  },
  {
    brainType: 'balthasar',
    stance: 'approve',
    reason: '如果此刻已经产生明显困倦，优先保护恢复质量。睡眠不是逃避任务，而是维持第二天稳定状态的基础。',
    focusPoints: ['身体承受度', '情绪稳定', '恢复质量'],
    uncertainties: ['当前疲劳程度'],
  },
  {
    brainType: 'casper',
    stance: 'approve',
    reason: '多数现实经验表明，困倦时继续硬撑会降低产出质量。若没有必须当晚完成的任务，提前睡眠更可执行。',
    focusPoints: ['现实可执行性', '历史经验', '任务压力'],
    uncertainties: ['是否有硬性截止时间'],
  },
];

export const DEFAULT_DECISION: DecisionSession = {
  id: '473',
  userId: 'preview',
  question: '现在是 21:58，这个点应该睡觉了吗？',
  questionType: 'boolean',
  finalStatus: 'approved',
  summary: '信息不足以形成绝对裁决，但日常决策中可按多数意见认可。',
  confidence: 0.72,
  variables: [],
  analyses: DEFAULT_ANALYSES,
  decisionSummary: {
    rule: '少数服从多数',
    majorityOpinion: 'Balthasar 与 Casper 支持睡眠',
    minorityOpinion: 'Melchior 因变量不足否决',
    missingInformation: ['身体疲劳程度', '次日任务紧迫性', '个人睡眠规律'],
    finalDecision: '认可',
  },
  createdAt: new Date().toISOString(),
};

// 视觉稿只展示 3 位裁决编号，真实 id 统一在展示层截取。
export const getDecisionCode = (id: string): string => id.slice(-3).toUpperCase();
