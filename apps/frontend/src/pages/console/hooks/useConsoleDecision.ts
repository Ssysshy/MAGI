import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Taro, { useLoad } from '@tarojs/taro';
import type { BrainAnalysis, DecisionSession } from '@magi/shared';
import { createDecisionSession, getDecisionSession } from '../../../api/decision';
import { getHttpStatusCode } from '../../../api/http';
import { BRAIN_ORDER, DEFAULT_DECISION } from '../console.constants';
import type { ConsoleStatus, UseConsoleDecisionResult } from '../console.types';

const sortAnalyses = (analyses: BrainAnalysis[]): BrainAnalysis[] => [...analyses].sort(
  (left: BrainAnalysis, right: BrainAnalysis): number => BRAIN_ORDER[left.brainType] - BRAIN_ORDER[right.brainType],
);

const getConsoleStatus = (decision: DecisionSession): ConsoleStatus => {
  if (!decision.question.trim() && decision.processingStatus === 'pending') {
    return 'RESOLUTION READY';
  }

  if (decision.processingStage === 'queued') {
    return 'QUESTION ACCEPTED';
  }

  if (
    decision.processingStage === 'brains'
    || decision.processingStage === 'core'
  ) {
    return 'ANALYZING';
  }

  return 'RESOLUTION READY';
};

export const useConsoleDecision = (): UseConsoleDecisionResult => {
  const [question, setQuestion] = useState<string>(DEFAULT_DECISION.question);
  const [decision, setDecision] = useState<DecisionSession>(DEFAULT_DECISION);
  const [loading, setLoading] = useState<boolean>(false);
  const pollingTimerRef = useRef<number | null>(null);
  const pollingRef = useRef<boolean>(false);

  const stopPolling = useCallback((): void => {
    pollingRef.current = false;

    if (pollingTimerRef.current !== null) {
      window.clearTimeout(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }
  }, []);

  const startPolling = useCallback((sessionId: string): void => {
    stopPolling();
    pollingRef.current = true;

    const poll = async (): Promise<void> => {
      if (!pollingRef.current) {
        return;
      }

      try {
        const session = await getDecisionSession(sessionId);

        if (!pollingRef.current) {
          return;
        }

        setDecision(session);

        if (session.processingStatus === 'completed' || session.processingStatus === 'failed') {
          stopPolling();
          setLoading(false);
          return;
        }
      } catch {
        stopPolling();
        setLoading(false);
        return;
      }

      pollingTimerRef.current = window.setTimeout((): void => {
        void poll();
      }, 2000);
    };

    void poll();
  }, [stopPolling]);

  useEffect((): (() => void) => () => stopPolling(), [stopPolling]);

  useLoad((query: Record<string, string | undefined>): void => {
    if (!query.id) {
      return;
    }

    void getDecisionSession(query.id)
      .then((session: DecisionSession): void => {
        setDecision(session);
        setQuestion(session.question);

        if (session.processingStatus === 'completed' || session.processingStatus === 'failed') {
          setLoading(false);
          stopPolling();
          return;
        }

        setLoading(true);
        startPolling(session.id);
      })
      .catch((): void => undefined);
  });

  const submitDecision = useCallback(async (): Promise<void> => {
    const trimmedQuestion = question.trim();

    if (trimmedQuestion.length < 2 || loading) {
      return;
    }

    setLoading(true);
    stopPolling();

    try {
      const session = await createDecisionSession(trimmedQuestion);
      setDecision(session);

      if (session.processingStatus === 'completed' || session.processingStatus === 'failed') {
        setLoading(false);
        return;
      }

      startPolling(session.id);
    } catch (error) {
      const statusCode = getHttpStatusCode(error);

      if (statusCode === 401 || statusCode === 403) {
        void Taro.navigateTo({ url: '/pages/login/index' });
        return;
      }

      setLoading(false);
      void Taro.showToast({
        title: '裁决服务暂不可用',
        icon: 'none',
      });
    }
  }, [loading, question, startPolling, stopPolling]);

  const analyses = useMemo((): BrainAnalysis[] => sortAnalyses(decision.analyses), [decision.analyses]);

  return {
    status: getConsoleStatus(decision),
    question,
    decision,
    loading,
    analyses,
    finalStatus: decision.finalStatus,
    setQuestion,
    submitDecision,
  };
};
