import { View } from '@tarojs/components';
import { AiConfigFloatButton } from '../../components/AiConfigFloatButton';
import { DecisionInputPanel } from '../../components/DecisionInputPanel';
import { MagiBrainGraph } from '../../components/MagiBrainGraph';
import { ConsoleResolutionSection } from './components/ConsoleResolutionSection';
import { ConsoleStatusBar } from './components/ConsoleStatusBar';
import { ConsoleTopBar } from './components/ConsoleTopBar';
import { getDecisionCode } from './console.constants';
import { useConsoleCapabilities } from './hooks/useConsoleCapabilities';
import { useConsoleClock } from './hooks/useConsoleClock';
import { useConsoleDecision } from './hooks/useConsoleDecision';
import './index.less';

const ConsolePage = (): JSX.Element => {
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
      />

      <View className="input-wrap">
        <DecisionInputPanel
          question={question}
          questionTypeLabel="日常决策"
          loading={loading}
          onQuestionChange={setQuestion}
          onSubmit={submitDecision}
        />
      </View>

      <ConsoleResolutionSection decision={decision} analyses={analyses} />
      <AiConfigFloatButton visible={canConfigureAi} />
    </View>
  );
};

export default ConsolePage;
