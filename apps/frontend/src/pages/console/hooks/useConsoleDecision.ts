import { useCallback, useMemo, useState } from 'react';
import Taro, { useLoad } from '@tarojs/taro';
import type { BrainAnalysis, DecisionSession } from '@magi/shared';
import { createDecisionSession, getDecisionSession } from '../../../api/decision';
import { getHttpStatusCode } from '../../../api/http';
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
    // 历史记录页带 id 回到主控台时，用服务端快照覆盖默认裁决。
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

    // 空问题和重复点击都不触发请求，保持一次问题一次裁决。
    if (trimmedQuestion.length < 2 || loading) {
      return;
    }

    setLoading(true);
    setStatus('QUESTION ACCEPTED');
    // 先给用户看到接收态，再进入分析态，贴近主控台执行流程。
    const analyzingTimer = window.setTimeout((): void => setStatus('ANALYZING'), 260);

    try {
      const session = await createDecisionSession(trimmedQuestion);
      window.clearTimeout(analyzingTimer);
      setDecision(session);
      setStatus('RESOLUTION READY');
    } catch (error) {
      window.clearTimeout(analyzingTimer);
      const statusCode = getHttpStatusCode(error);

      if (statusCode === 401 || statusCode === 403) {
        void Taro.navigateTo({ url: '/pages/login/index' });
        return;
      }

      setStatus('RESOLUTION READY');
      void Taro.showToast({
        title: '裁决服务暂不可用',
        icon: 'none',
      });
    } finally {
      setLoading(false);
    }
  }, [loading, question]);

  // 三脑详情固定按 Melchior、Balthasar、Casper 展示，避免接口返回顺序影响阅读。
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
