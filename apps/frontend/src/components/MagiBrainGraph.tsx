import { View, Text } from '@tarojs/components';
import type { BrainAnalysis, FinalStatus } from '@magi/shared';
import type { ConsoleStatus } from '../pages/console/console.types';
import { BRAIN_STANCE_TEXT, GRAPH_FINAL_STATUS_TEXT } from '../pages/console/console.constants';
import './MagiBrainGraph.less';

export interface MagiBrainGraphProps {
  status: ConsoleStatus;
  finalStatus: FinalStatus;
  analyses: BrainAnalysis[];
  decisionCode: string;
}

const getBrainClass = (brainType: string, finalStatus: FinalStatus, analyses: BrainAnalysis[]): string => {
  const analysis = analyses.find((item: BrainAnalysis): boolean => item.brainType === brainType);
  // Melchior 在参考图中固定承担红色否决位；最终否决时全部按高风险态处理。
  const isNegative = analysis?.stance === 'reject' || finalStatus === 'rejected' || brainType === 'melchior';

  return isNegative ? 'brain brain-red' : 'brain brain-green';
};

export const MagiBrainGraph = ({ status, finalStatus, analyses, decisionCode }: MagiBrainGraphProps): JSX.Element => (
  <View className="brain-graph">
    <View className="console-frame">
      <View className="frame-header">
        <View>
          <Text className="jp-title">质 问</Text>
          <View className="green-lines" />
          <Text className="meta-code">CODE:{decisionCode}</Text>
          <Text className="meta-line">FILE:MAGI_SYS</Text>
          <Text className="meta-line">EXTENTION:3023</Text>
          <Text className="meta-line">EX_MODE:OFF</Text>
          <Text className="meta-line">PRIORITY:AAA</Text>
        </View>
        <View className="resolve-side">
          <Text className="jp-title">解 决</Text>
          <View className="green-lines" />
          <View className="approve-box">{GRAPH_FINAL_STATUS_TEXT[finalStatus]}</View>
        </View>
      </View>

      <View className="brain-map">
        <View className="link link-left" />
        <View className="link link-right" />
        <View className="link link-bottom" />
        <View className={getBrainClass('balthasar', finalStatus, analyses) + ' brain-balthasar'}>
          <Text>BALTHASAR · 2</Text>
        </View>
        <View className={getBrainClass('casper', finalStatus, analyses) + ' brain-casper'}>
          <Text>CASPER · 3</Text>
        </View>
        <View className={getBrainClass('melchior', finalStatus, analyses) + ' brain-melchior'}>
          <Text>MELCHIOR · 1</Text>
        </View>
        <View className="magi-core">
          <Text>MAGI</Text>
          <Text className="core-state">{status}</Text>
        </View>
      </View>

      <View className="graph-separator" />
      <View className="question-caption">
        <Text>QUESTION</Text>
        <Text>日常决策 / 少数服从多数</Text>
      </View>
    </View>
  </View>
);

export const getBrainStanceText = (analysis: BrainAnalysis): string => BRAIN_STANCE_TEXT[analysis.stance] ?? '待定';
