import Taro from '@tarojs/taro';

const apiBaseUrl = process.env.VITE_API_BASE_URL || 'http://localhost:3001';

export const requestJson = async <T>(url: string, options: Taro.request.Option = {}): Promise<T> => {
  const response = await Taro.request<T>({
    ...options,
    url: `${apiBaseUrl}${url}`,
    credentials: 'include',
    header: {
      'Content-Type': 'application/json',
      ...options.header,
    },
  });

  if (response.statusCode >= 400) {
    throw new Error(`HTTP_${response.statusCode}`);
  }

  return response.data;
};
