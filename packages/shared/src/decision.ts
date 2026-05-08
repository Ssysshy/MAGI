export type QuestionType = 'boolean' | 'multiple_choice' | 'priority' | 'strategy' | 'diagnosis';

export type FinalStatus = 'approved' | 'rejected' | 'deferred' | 'refused';

export type BrainType = 'melchior' | 'balthasar' | 'casper';

export type BrainStance = 'approve' | 'reject' | 'defer' | 'uncertain';

export type DecisionProcessingStage =
  | 'queued'
  | 'melchior'
  | 'balthasar'
  | 'casper'
  | 'core'
  | 'completed'
  | 'failed';

export type DecisionProcessingStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface DecisionVariable {
  name: string;
  value: string;
  isMissing: boolean;
  isCritical: boolean;
}

export interface BrainAnalysis {
  brainType: BrainType;
  status: DecisionProcessingStatus;
  stance: BrainStance;
  reason: string;
  focusPoints: string[];
  uncertainties: string[];
  unavailable?: boolean;
}

export interface DecisionSummary {
  rule: string;
  majorityOpinion: string;
  minorityOpinion: string;
  missingInformation: string[];
  finalDecision: string;
}

export interface DecisionSession {
  id: string;
  userId: string;
  question: string;
  questionType: QuestionType;
  processingStage: DecisionProcessingStage;
  processingStatus: DecisionProcessingStatus;
  finalStatus: FinalStatus;
  summary: string;
  confidence: number;
  variables: DecisionVariable[];
  analyses: BrainAnalysis[];
  decisionSummary: DecisionSummary;
  createdAt: string;
}

export interface CreateDecisionSessionRequest {
  question: string;
}
