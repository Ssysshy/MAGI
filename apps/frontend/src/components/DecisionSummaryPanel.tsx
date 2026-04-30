import { Text, View } from '@tarojs/components';
import type { DecisionSession, FinalStatus } from '@magi/shared';
import { FINAL_STATUS_TEXT, QUESTION_TYPE_TEXT } from '../pages/console/console.constants';

export interface DecisionSummaryPanelProps {
  decision: DecisionSession;
}

export const DecisionSummaryPanel = ({ decision }: DecisionSummaryPanelProps): JSX.Element => (
  <View className="summary-panel">
    <Text>议案分类：{QUESTION_TYPE_TEXT[decision.questionType]}</Text>
    <Text>决策规则：{decision.decisionSummary.rule}</Text>
    <Text>最终结论：{FINAL_STATUS_TEXT[decision.finalStatus]}</Text>
    <Text>置信度：{Math.round(decision.confidence * 100)}%</Text>
  </View>
);

export const getFinalStatusText = (status: FinalStatus): string => FINAL_STATUS_TEXT[status];
