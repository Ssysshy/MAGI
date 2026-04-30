import type { CurrentUser, DecisionSession, UserCapabilities } from '@magi/shared';
import { getCapabilities, getCurrentUser } from '../api/auth';

export interface SessionState {
  user: CurrentUser | null;
  capabilities: UserCapabilities | null;
  selectedDecision: DecisionSession | null;
}

export const sessionState: SessionState = {
  user: null,
  capabilities: null,
  selectedDecision: null,
};

export const loadSession = async (): Promise<SessionState> => {
  const [user, capabilities] = await Promise.all([
    getCurrentUser(),
    getCapabilities(),
  ]);

  sessionState.user = user;
  sessionState.capabilities = capabilities;

  return sessionState;
};
