import { Text, View } from '@tarojs/components';
import type { BrainAnalysis, DecisionSession } from '@magi/shared';
import { BrainAnalysisPanel } from '../../../components/BrainAnalysisPanel';
import { DecisionSummaryPanel } from '../../../components/DecisionSummaryPanel';
import './ConsoleResolutionSection.less';

export interface ConsoleResolutionSectionProps {
  decision: DecisionSession;
  analyses: BrainAnalysis[];
}

export const ConsoleResolutionSection = ({ decision, analyses }: ConsoleResolutionSectionProps): JSX.Element => (
  <>
    <Text className="resolution-title">RESOLUTION ANALYSIS</Text>
    <DecisionSummaryPanel decision={decision} />

    <View className="analysis-list">
      {analyses.map((analysis: BrainAnalysis): JSX.Element => (
        <BrainAnalysisPanel key={analysis.brainType} analysis={analysis} />
      ))}
    </View>
  </>
);
