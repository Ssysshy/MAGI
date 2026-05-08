import { Text, View } from '@tarojs/components';
import type { BrainAnalysis, FinalStatus } from '@magi/shared';
import { BRAIN_ANALYSIS_META } from '../pages/console/console.constants';
import { getBrainStanceText, getBrainVisualClass } from './MagiBrainGraph';
import './BrainAnalysisPanel.less';

export interface BrainAnalysisPanelProps {
  analysis: BrainAnalysis;
  finalStatus: FinalStatus;
}

export const BrainAnalysisPanel = ({ analysis, finalStatus }: BrainAnalysisPanelProps): JSX.Element => {
  const meta = BRAIN_ANALYSIS_META[analysis.brainType];

  return (
    <View className={`analysis-card analysis-${getBrainVisualClass(analysis, finalStatus)}`}>
      <Text className="analysis-title">{meta.title}</Text>
      <Text className="analysis-role">{meta.role}</Text>
      <Text className="analysis-reason">{analysis.reason}</Text>
      <View className="analysis-footer">
        <Text>{getBrainStanceText(analysis)}</Text>
      </View>
    </View>
  );
};
