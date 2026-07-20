import Taro from '@tarojs/taro';
import { runtimeConfig } from '../config/runtime';
import { clearAccessToken, getAccessToken } from '../utils/auth-token';

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

export const requestJson = async <T>(url: string, options: Partial<Taro.request.Option> = {}): Promise<T> => {
  const accessToken = getAccessToken();

  // 所有接口统一走这里，确保 H5 / 小程序请求头和鉴权行为一致。
  const response = await Taro.request<T>({
    ...options,
    url: `${runtimeConfig.apiBaseUrl}${url}`,
    credentials: 'include',
    header: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...options.header,
    },
  });

  // 业务层只关心成功数据；失败统一抛出状态码错误交给页面处理。
  if (response.statusCode >= 400) {
    if (response.statusCode === 401) {
      clearAccessToken();
    }

    const error = new Error(`HTTP_${response.statusCode}`) as HttpError;
    error.statusCode = response.statusCode;
    throw error;
  }

  return response.data;
};
