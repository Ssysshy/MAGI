import { useState } from 'react';
import { useLoad } from '@tarojs/taro';
import { getCapabilities } from '../../../api/auth';

export const useConsoleCapabilities = (): boolean => {
  const [canConfigureAi, setCanConfigureAi] = useState<boolean>(false);

  useLoad((): void => {
    void getCapabilities()
      .then((capabilities): void => setCanConfigureAi(capabilities.canConfigureAiProvider))
      .catch((): void => setCanConfigureAi(false));
  });

  return canConfigureAi;
};
