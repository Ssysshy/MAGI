import { useState } from 'react';
import Taro, { useLoad } from '@tarojs/taro';
import { View } from '@tarojs/components';
import { AiConfigFloatButton } from '../../components/AiConfigFloatButton';
import { MagiBrainGraph } from '../../components/MagiBrainGraph';
import { getCurrentUser } from '../../api/auth';
import { getHttpStatusCode } from '../../api/http';
import { ConsoleResolutionSection } from './components/ConsoleResolutionSection';
import { ConsoleStatusBar } from './components/ConsoleStatusBar';
import { ConsoleTopBar } from './components/ConsoleTopBar';
import { getDecisionCode } from './console.constants';
import { useConsoleCapabilities } from './hooks/useConsoleCapabilities';
import { useConsoleClock } from './hooks/useConsoleClock';
import { useConsoleDecision } from './hooks/useConsoleDecision';
import './index.less';

const ConsoleContent = (): JSX.Element => {
  const clock = useConsoleClock();
  const canConfigureAi = useConsoleCapabilities();
  const {
    status,
    question,
    decision,
    loading,
    analyses,
    finalStatus,
    setQuestion,
    submitDecision,
  } = useConsoleDecision();
  const decisionCode = getDecisionCode(decision.id);

  return (
    <View className="magi-page console-page">
      <ConsoleTopBar />
      <ConsoleStatusBar status={status} clock={clock} decisionCode={decisionCode} />

      <MagiBrainGraph
        status={status}
        finalStatus={finalStatus}
        analyses={analyses}
        decisionCode={decisionCode}
        question={question}
        loading={loading}
        onQuestionChange={setQuestion}
        onSubmit={submitDecision}
      />

      <ConsoleResolutionSection decision={decision} analyses={analyses} />
      <AiConfigFloatButton visible={canConfigureAi} />
    </View>
  );
};

const ConsolePage = (): JSX.Element => {
  const [authChecked, setAuthChecked] = useState<boolean>(false);
  const [authenticated, setAuthenticated] = useState<boolean>(false);

  useLoad((): void => {
    void getCurrentUser()
      .then((): void => {
        setAuthenticated(true);
        setAuthChecked(true);
      })
      .catch((error: unknown): void => {
        const statusCode = getHttpStatusCode(error);

        if (statusCode === 401 || statusCode === 403) {
          setAuthenticated(false);
          setAuthChecked(true);
          void Taro.redirectTo({ url: '/pages/login/index' });
          return;
        }

        setAuthenticated(true);
        setAuthChecked(true);
        void Taro.showToast({
          title: '用户状态校验失败',
          icon: 'none',
        });
      });
  });

  if (!authChecked || !authenticated) {
    return <View className="magi-page console-page" />;
  }

  return <ConsoleContent />;
};

export default ConsolePage;
