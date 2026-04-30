import { useCallback, useMemo, useState } from 'react';
import Taro, { useLoad } from '@tarojs/taro';
import type { BrainAnalysis, DecisionSession } from '@magi/shared';
import { createDecisionSession, getDecisionSession } from '../../../api/decision';
import { BRAIN_ORDER, DEFAULT_DECISION } from '../console.constants';
import type { ConsoleStatus, UseConsoleDecisionResult } from '../console.types';

const sortAnalyses = (analyses: BrainAnalysis[]): BrainAnalysis[] => [...analyses].sort(
  (left: BrainAnalysis, right: BrainAnalysis): number => BRAIN_ORDER[left.brainType] - BRAIN_ORDER[right.brainType],
);

export const useConsoleDecision = (): UseConsoleDecisionResult => {
  const [status, setStatus] = useState<ConsoleStatus>('RESOLUTION READY');
  const [question, setQuestion] = useState<string>(DEFAULT_DECISION.question);
  const [decision, setDecision] = useState<DecisionSession>(DEFAULT_DECISION);
  const [loading, setLoading] = useState<boolean>(false);

  useLoad((query: Record<string, string | undefined>): void => {
    if (!query.id) {
      return;
    }

    void getDecisionSession(query.id)
      .then((session: DecisionSession): void => {
        setDecision(session);
        setQuestion(session.question);
        setStatus('RESOLUTION READY');
      })
      .catch((): void => undefined);
  });

  const submitDecision = useCallback(async (): Promise<void> => {
    const trimmedQuestion = question.trim();

    if (trimmedQuestion.length < 2 || loading) {
      return;
    }

    setLoading(true);
    setStatus('QUESTION ACCEPTED');
    window.setTimeout((): void => setStatus('ANALYZING'), 260);

    try {
      const session = await createDecisionSession(trimmedQuestion);
      setDecision(session);
      setStatus('RESOLUTION READY');
    } catch {
      void Taro.navigateTo({ url: '/pages/login/index' });
    } finally {
      setLoading(false);
    }
  }, [loading, question]);

  const analyses = useMemo((): BrainAnalysis[] => sortAnalyses(decision.analyses), [decision.analyses]);

  return {
    status,
    question,
    decision,
    loading,
    analyses,
    finalStatus: decision.finalStatus,
    setQuestion,
    submitDecision,
  };
};
