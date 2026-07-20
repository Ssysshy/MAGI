interface RuntimeEnv {
  TARO_APP_API_BASE_URL?: string;
}

interface ProcessLike {
  env?: RuntimeEnv;
}

const processLike = (globalThis as typeof globalThis & { process?: ProcessLike }).process;

const getApiBaseUrl = (): string => processLike?.env?.TARO_APP_API_BASE_URL || 'http://localhost:3001';

export interface RuntimeConfig {
  apiBaseUrl: string;
}

export const runtimeConfig: RuntimeConfig = {
  apiBaseUrl: getApiBaseUrl(),
};
