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

const getBrainVisualState = (analysis: BrainAnalysis, finalStatus: FinalStatus): string => {
  if (analysis.status === 'pending') {
    return 'pending';
  }

  if (analysis.status === 'running') {
    return 'running';
  }

  if (analysis.status === 'failed') {
    return 'failed';
  }

  if (analysis.stance === 'approve') {
    return 'approved';
  }

  if (analysis.stance === 'reject') {
    return 'rejected';
  }

  if (analysis.stance === 'defer') {
    return 'deferred';
  }

  if (finalStatus === 'refused') {
    return 'refused';
  }

  return 'pending';
};

const getCoreStateText = (status: ConsoleStatus, finalStatus: FinalStatus, analyses: BrainAnalysis[]): string => {
  if (analyses.every((analysis: BrainAnalysis): boolean => analysis.status === 'pending')) {
    return '待机';
  }

  if (analyses.some((analysis: BrainAnalysis): boolean => analysis.status === 'running')) {
    return '分析中';
  }

  if (status === 'QUESTION ACCEPTED') {
    return '接收中';
  }

  if (status === 'ANALYZING') {
    return '汇总中';
  }

  return GRAPH_FINAL_STATUS_TEXT[finalStatus];
};

const getResolveBoxText = (analyses: BrainAnalysis[], finalStatus: FinalStatus): string => {
  if (analyses.every((analysis: BrainAnalysis): boolean => analysis.status === 'pending')) {
    return '待机';
  }

  return GRAPH_FINAL_STATUS_TEXT[finalStatus];
};

const getResolveBoxClassName = (analyses: BrainAnalysis[], finalStatus: FinalStatus): string => {
  if (analyses.every((analysis: BrainAnalysis): boolean => analysis.status === 'pending')) {
    return 'approve-box-pending';
  }

  return `approve-box-${finalStatus}`;
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
          <View className={`approve-box ${getResolveBoxClassName(analyses, finalStatus)}`}>
            {getResolveBoxText(analyses, finalStatus)}
          </View>
        </View>
      </View>

      <View className="brain-map">
        <View className="link link-left" />
        <View className="link link-right" />
        <View className="link link-bottom" />
        {analyses.map((analysis: BrainAnalysis): JSX.Element => (
          <View
            key={analysis.brainType}
            className={`brain brain-${getBrainVisualState(analysis, finalStatus)} brain-${analysis.brainType}`}
          >
            <Text>{analysis.brainType.toUpperCase()} · {analysis.brainType === 'melchior' ? '1' : analysis.brainType === 'balthasar' ? '2' : '3'}</Text>
          </View>
        ))}
        <View className="magi-core">
          <Text>MAGI</Text>
          <Text className="core-state">{getCoreStateText(status, finalStatus, analyses)}</Text>
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

export const getBrainStanceText = (analysis: BrainAnalysis): string => {
  if (analysis.status === 'pending') {
    return '等待中';
  }

  if (analysis.status === 'running') {
    return '分析中';
  }

  if (analysis.status === 'failed') {
    return '不可用';
  }

  return BRAIN_STANCE_TEXT[analysis.stance] ?? '待定';
};

export const getBrainVisualClass = (analysis: BrainAnalysis, finalStatus: FinalStatus): string => getBrainVisualState(analysis, finalStatus);
