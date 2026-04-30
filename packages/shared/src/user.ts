export type UserRole = 'user' | 'admin';

export interface CurrentUser {
  id: string;
  email: string;
  role: UserRole;
  canConfigureAiProvider: boolean;
}

export type AiProviderMode = 'system' | 'custom';

export interface UserCapabilities {
  canConfigureAiProvider: boolean;
  aiProviderMode: AiProviderMode;
}
