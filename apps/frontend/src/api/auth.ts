import type { AuthResult, CurrentUser, UserCapabilities } from '@magi/shared';
import { requestJson } from './http';
import { clearAccessToken, setAccessToken } from '../utils/auth-token';

export interface AuthPayload {
  email: string;
  password: string;
}

const saveAuthResult = (result: AuthResult): AuthResult => {
  setAccessToken(result.accessToken);
  return result;
};

export const login = async (payload: AuthPayload): Promise<AuthResult> => saveAuthResult(await requestJson<AuthResult>('/api/auth/login', {
  method: 'POST',
  data: payload,
}));

export const register = async (payload: AuthPayload): Promise<AuthResult> => saveAuthResult(await requestJson<AuthResult>('/api/auth/register', {
  method: 'POST',
  data: payload,
}));

export const logout = async (): Promise<{ ok: true }> => {
  try {
    return await requestJson<{ ok: true }>('/api/auth/logout', {
      method: 'POST',
    });
  } finally {
    clearAccessToken();
  }
};

export const getCurrentUser = (): Promise<CurrentUser> => requestJson('/api/me');

export const getCapabilities = (): Promise<UserCapabilities> => requestJson('/api/me/capabilities');
