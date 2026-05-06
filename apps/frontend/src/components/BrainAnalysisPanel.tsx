import { Text, View } from '@tarojs/components';
import type { BrainAnalysis } from '@magi/shared';
import { BRAIN_ANALYSIS_META } from '../pages/console/console.constants';
import { getBrainStanceText } from './MagiBrainGraph';
import './BrainAnalysisPanel.less';

export interface BrainAnalysisPanelProps {
  analysis: BrainAnalysis;
}

export const BrainAnalysisPanel = ({ analysis }: BrainAnalysisPanelProps): JSX.Element => {
  const meta = BRAIN_ANALYSIS_META[analysis.brainType];

  return (
    <View className={meta.className}>
      <Text className="analysis-title">{meta.title}</Text>
      <Text className="analysis-role">{meta.role}</Text>
      <Text className="analysis-reason">{analysis.reason}</Text>
      <View className="analysis-footer">
        <Text>{getBrainStanceText(analysis)}</Text>
      </View>
    </View>
  );
};
