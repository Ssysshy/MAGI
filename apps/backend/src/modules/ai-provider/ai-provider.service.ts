import type { PrismaClient } from '@prisma/client';
import { decryptText, encryptText } from '../../utils/crypto.js';
import type { SaveAiProviderConfigInput } from './ai-provider.schema.js';

export interface MaskedAiProviderConfig {
  id: string;
  provider: string;
  baseUrl: string;
  model: string;
  enabled: boolean;
  apiKeyMasked: string;
}

export interface UsableAiProviderConfig {
  provider: string;
  baseUrl: string;
  model: string;
  apiKey: string;
}

export const createAiProviderService = (prisma: PrismaClient) => ({
  async save(userId: string, input: SaveAiProviderConfigInput): Promise<MaskedAiProviderConfig> {
    const config = await prisma.aiProviderConfig.upsert({
      where: { userId },
      create: {
        userId,
        provider: input.provider,
        baseUrl: input.baseUrl,
        model: input.model,
        apiKeyEncrypted: encryptText(input.apiKey),
        enabled: input.enabled,
      },
      update: {
        provider: input.provider,
        baseUrl: input.baseUrl,
        model: input.model,
        apiKeyEncrypted: encryptText(input.apiKey),
        enabled: input.enabled,
      },
    });

    return {
      id: config.id,
      provider: config.provider,
      baseUrl: config.baseUrl,
      model: config.model,
      enabled: config.enabled,
      apiKeyMasked: '********',
    };
  },

  async getMasked(userId: string): Promise<MaskedAiProviderConfig | null> {
    const config = await prisma.aiProviderConfig.findUnique({ where: { userId } });

    if (!config) {
      return null;
    }

    return {
      id: config.id,
      provider: config.provider,
      baseUrl: config.baseUrl,
      model: config.model,
      enabled: config.enabled,
      apiKeyMasked: '********',
    };
  },

  async getUsableConfig(userId: string): Promise<UsableAiProviderConfig | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { aiProviderConfig: true },
    });

    if (user?.canConfigureAiProvider && user.aiProviderConfig?.enabled) {
      return {
        provider: user.aiProviderConfig.provider,
        baseUrl: user.aiProviderConfig.baseUrl,
        model: user.aiProviderConfig.model,
        apiKey: decryptText(user.aiProviderConfig.apiKeyEncrypted),
      };
    }

    return null;
  },
});
