import { Text, View } from '@tarojs/components';
import type { ConsoleStatus } from '../console.types';
import './ConsoleStatusBar.less';

export interface ConsoleStatusBarProps {
  status: ConsoleStatus;
  clock: string;
  decisionCode: string;
}

export const ConsoleStatusBar = ({ status, clock, decisionCode }: ConsoleStatusBarProps): JSX.Element => (
  <View className="status-row">
    <Text>{status}</Text>
    <Text>{clock}</Text>
    <Text>CODE:{decisionCode}</Text>
  </View>
);
