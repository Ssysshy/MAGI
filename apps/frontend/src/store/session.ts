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
  // 用户信息和能力互不依赖，并行加载减少进入主控台前的等待。
  const [user, capabilities] = await Promise.all([
    getCurrentUser(),
    getCapabilities(),
  ]);

  sessionState.user = user;
  sessionState.capabilities = capabilities;

  return sessionState;
};
