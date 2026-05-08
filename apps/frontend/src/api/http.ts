import Taro from '@tarojs/taro';

interface ViteEnvMeta {
  env?: {
    VITE_API_BASE_URL?: string;
  };
}

export interface HttpError extends Error {
  statusCode: number;
}

const HTTP_STATUS_RE = /^HTTP_(\d{3})$/;

export const getHttpStatusCode = (error: unknown): number | null => {
  if (error && typeof error === 'object') {
    const statusCode = (error as Partial<HttpError>).statusCode;

    if (typeof statusCode === 'number') {
      return statusCode;
    }
  }

  if (error instanceof Error) {
    const matched = error.message.match(HTTP_STATUS_RE);

    if (matched) {
      return Number(matched[1]);
    }
  }

  return null;
};

const apiBaseUrl = (import.meta as ImportMeta & ViteEnvMeta).env?.VITE_API_BASE_URL || 'http://localhost:3001';

export const requestJson = async <T>(url: string, options: Partial<Taro.request.Option> = {}): Promise<T> => {
  // 所有接口统一走这里，确保 Cookie 会话和 JSON Header 行为一致。
  const response = await Taro.request<T>({
    ...options,
    url: `${apiBaseUrl}${url}`,
    credentials: 'include',
    header: {
      'Content-Type': 'application/json',
      ...options.header,
    },
  });

  // 业务层只关心成功数据；失败统一抛出状态码错误交给页面处理。
  if (response.statusCode >= 400) {
    const error = new Error(`HTTP_${response.statusCode}`) as HttpError;
    error.statusCode = response.statusCode;
    throw error;
  }

  return response.data;
};
