import Taro from '@tarojs/taro';
import { Text, View } from '@tarojs/components';
import './ConsoleTopBar.less';

export const ConsoleTopBar = (): JSX.Element => {
  const openHistory = (): void => {
    void Taro.navigateTo({ url: '/pages/history/index' });
  };

  return (
    <View className="topbar">
      <Text className="topbar-spacer" />
      <Text className="brand">MAGI 主控台</Text>
      <View className="topbar-actions">
        <Text onClick={openHistory}>•••</Text>
      </View>
    </View>
  );
};
