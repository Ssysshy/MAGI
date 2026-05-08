import { Text, View } from '@tarojs/components';
import type { DecisionSession, FinalStatus } from '@magi/shared';
import { FINAL_STATUS_TEXT, QUESTION_TYPE_TEXT } from '../pages/console/console.constants';
import './DecisionSummaryPanel.less';

export interface DecisionSummaryPanelProps {
  decision: DecisionSession;
}

export const DecisionSummaryPanel = ({ decision }: DecisionSummaryPanelProps): JSX.Element => {
  if (decision.processingStage === 'queued') {
    return (
      <View className="summary-panel">
        <Text>主控状态：等待裁决开始</Text>
      </View>
    );
  }

  if (
    decision.processingStage === 'melchior'
    || decision.processingStage === 'balthasar'
    || decision.processingStage === 'casper'
    || decision.processingStage === 'core'
  ) {
    return (
      <View className="summary-panel">
        <Text>主控状态：主控汇总中</Text>
        <Text>议案分类：{QUESTION_TYPE_TEXT[decision.questionType]}</Text>
      </View>
    );
  }

  return (
    <View className="summary-panel">
      <Text>议案分类：{QUESTION_TYPE_TEXT[decision.questionType]}</Text>
      <Text>决策规则：{decision.decisionSummary.rule}</Text>
      <Text>最终结论：{FINAL_STATUS_TEXT[decision.finalStatus]}</Text>
      <Text>主控裁决：{decision.decisionSummary.finalDecision}</Text>
      <Text>多数意见：{decision.decisionSummary.majorityOpinion}</Text>
      <Text>少数意见：{decision.decisionSummary.minorityOpinion}</Text>
      {decision.decisionSummary.missingInformation.length > 0 ? (
        <Text>缺失信息：{decision.decisionSummary.missingInformation.join('；')}</Text>
      ) : null}
      <Text>置信度：{Math.round(decision.confidence * 100)}%</Text>
    </View>
  );
};

export const getFinalStatusText = (status: FinalStatus): string => FINAL_STATUS_TEXT[status];
