import type { CurrentUser, UserCapabilities } from '@magi/shared';
import { requestJson } from './http';

export interface AuthPayload {
  email: string;
  password: string;
}

export const login = (payload: AuthPayload): Promise<CurrentUser> => requestJson('/api/auth/login', {
  method: 'POST',
  data: payload,
});

export const register = (payload: AuthPayload): Promise<CurrentUser> => requestJson('/api/auth/register', {
  method: 'POST',
  data: payload,
});

export const logout = (): Promise<{ ok: true }> => requestJson('/api/auth/logout', {
  method: 'POST',
});

export const getCurrentUser = (): Promise<CurrentUser> => requestJson('/api/me');

export const getCapabilities = (): Promise<UserCapabilities> => requestJson('/api/me/capabilities');
