import { useState } from 'react';
import { useLoad } from '@tarojs/taro';
import { getCapabilities } from '../../../api/auth';

export const useConsoleCapabilities = (): boolean => {
  const [canConfigureAi, setCanConfigureAi] = useState<boolean>(false);

  useLoad((): void => {
    // 能力加载失败按普通用户处理，避免未登录时误展示 AI 配置入口。
    void getCapabilities()
      .then((capabilities): void => setCanConfigureAi(capabilities.canConfigureAiProvider))
      .catch((): void => setCanConfigureAi(false));
  });

  return canConfigureAi;
};
