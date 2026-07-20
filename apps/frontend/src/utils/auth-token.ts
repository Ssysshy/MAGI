import Taro from '@tarojs/taro';

const ACCESS_TOKEN_STORAGE_KEY = 'magi_access_token';

export const getAccessToken = (): string | null => {
  try {
    const token = Taro.getStorageSync<string>(ACCESS_TOKEN_STORAGE_KEY);
    return typeof token === 'string' && token.length > 0 ? token : null;
  } catch {
    return null;
  }
};

export const setAccessToken = (token: string): void => {
  Taro.setStorageSync(ACCESS_TOKEN_STORAGE_KEY, token);
};

export const clearAccessToken = (): void => {
  Taro.removeStorageSync(ACCESS_TOKEN_STORAGE_KEY);
};
