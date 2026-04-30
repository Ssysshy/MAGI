import type { BrainAnalysis, DecisionSession, FinalStatus } from '@magi/shared';

export type ConsoleStatus = 'IDLE' | 'QUESTION ACCEPTED' | 'ANALYZING' | 'RESOLUTION READY';

export interface UseConsoleDecisionResult {
  status: ConsoleStatus;
  question: string;
  decision: DecisionSession;
  loading: boolean;
  analyses: BrainAnalysis[];
  finalStatus: FinalStatus;
  setQuestion: (value: string) => void;
  submitDecision: () => Promise<void>;
}

export interface BrainAnalysisMeta {
  title: string;
  role: string;
  className: string;
}
