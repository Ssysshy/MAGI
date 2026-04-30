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
    // 每个用户只允许一份个人 AI 配置；重复保存走 upsert 覆盖当前配置。
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

    // API Key 永远不回传明文，只告诉前端配置是否存在。
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

    // 只有授权用户且显式启用个人配置时，裁决流程才会解密并使用个人 API。
    if (user?.canConfigureAiProvider && user.aiProviderConfig?.enabled) {
      return {
        provider: user.aiProviderConfig.provider,
        baseUrl: user.aiProviderConfig.baseUrl,
        model: user.aiProviderConfig.model,
        apiKey: decryptText(user.aiProviderConfig.apiKeyEncrypted),
      };
    }

    // 返回 null 代表调用方应回退到系统 AI API。
    return null;
  },
});
