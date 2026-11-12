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

const toMaskedConfig = (config: {
  id: string;
  provider: string;
  baseUrl: string;
  model: string;
  enabled: boolean;
}): MaskedAiProviderConfig => ({
  id: config.id,
  provider: config.provider,
  baseUrl: config.baseUrl,
  model: config.model,
  enabled: config.enabled,
  apiKeyMasked: '********',
});

export const createAiProviderService = (prisma: PrismaClient) => ({
  async save(userId: string, input: SaveAiProviderConfigInput): Promise<MaskedAiProviderConfig> {
    const existingConfig = await prisma.aiProviderConfig.findUnique({ where: { userId } });

    if ((!existingConfig || existingConfig.provider !== input.provider || existingConfig.baseUrl !== input.baseUrl) && !input.apiKey) {
      const error = new Error('API_KEY_REQUIRED') as Error & { statusCode: number };
      error.statusCode = 400;
      throw error;
    }

    if (!existingConfig) {
      const config = await prisma.aiProviderConfig.create({
        data: {
          userId,
          provider: input.provider,
          baseUrl: input.baseUrl,
          model: input.model,
          apiKeyEncrypted: encryptText(input.apiKey as string),
          enabled: input.enabled,
        },
      });

      return toMaskedConfig(config);
    }

    const config = await prisma.aiProviderConfig.update({
      where: { userId },
      data: {
        provider: input.provider,
        baseUrl: input.baseUrl,
        model: input.model,
        enabled: input.enabled,
        ...(input.apiKey ? { apiKeyEncrypted: encryptText(input.apiKey) } : {}),
      },
    });

    return toMaskedConfig(config);
  },

  async getMasked(userId: string): Promise<MaskedAiProviderConfig | null> {
    const config = await prisma.aiProviderConfig.findUnique({ where: { userId } });

    if (!config) {
      return null;
    }

    // API Key 永远不回传明文，只告诉前端配置是否存在。
    return toMaskedConfig(config);
  },

  async getUsableConfig(userId: string): Promise<UsableAiProviderConfig | null> {
    const config = await prisma.aiProviderConfig.findUnique({ where: { userId } });

    if (config?.enabled && config.provider === 'deepseek' && config.baseUrl === 'https://api.deepseek.com') {
      return {
        provider: 'deepseek',
        baseUrl: 'https://api.deepseek.com',
        model: 'deepseek-flash',
        apiKey: decryptText(config.apiKeyEncrypted),
      };
    }

    return null;
  },
});
