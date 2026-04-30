import Taro from '@tarojs/taro';

const apiBaseUrl = process.env.VITE_API_BASE_URL || 'http://localhost:3001';

export const requestJson = async <T>(url: string, options: Taro.request.Option = {}): Promise<T> => {
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
    throw new Error(`HTTP_${response.statusCode}`);
  }

  return response.data;
};
