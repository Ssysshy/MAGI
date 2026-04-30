import { requestJson } from './http';

export interface AiProviderConfigPayload {
  provider: string;
  baseUrl: string;
  model: string;
  apiKey: string;
  enabled: boolean;
}

export interface AiProviderConfigView {
  id: string;
  provider: string;
  baseUrl: string;
  model: string;
  enabled: boolean;
  apiKeyMasked: string;
}

export const getAiProviderConfig = (): Promise<AiProviderConfigView | null> => requestJson('/api/ai-provider-config');

export const saveAiProviderConfig = (payload: AiProviderConfigPayload): Promise<AiProviderConfigView> => requestJson('/api/ai-provider-config', {
  method: 'PUT',
  data: payload,
});
