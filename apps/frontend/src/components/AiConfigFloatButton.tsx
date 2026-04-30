import Taro from '@tarojs/taro';
import { View, Text } from '@tarojs/components';
import './AiConfigFloatButton.less';

export interface AiConfigFloatButtonProps {
  visible: boolean;
}

export const AiConfigFloatButton = ({ visible }: AiConfigFloatButtonProps): JSX.Element | null => {
  if (!visible) {
    return null;
  }

  const handleOpen = (): void => {
    void Taro.navigateTo({ url: '/pages/ai-provider/index' });
  };

  return (
    <View className="ai-config-float" onClick={handleOpen}>
      <Text>AI</Text>
    </View>
  );
};
