import type { DecisionSession } from '@magi/shared';
import { requestJson } from './http';

export const createDecisionSession = (question: string): Promise<DecisionSession> => requestJson('/api/decision-sessions', {
  method: 'POST',
  data: { question },
});

export const listDecisionSessions = (): Promise<DecisionSession[]> => requestJson('/api/decision-sessions');

export const getDecisionSession = (id: string): Promise<DecisionSession> => requestJson(`/api/decision-sessions/${id}`);
