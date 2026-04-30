import { useEffect, useState } from 'react';
import Taro from '@tarojs/taro';
import { Button, Input, Switch, Text, View } from '@tarojs/components';
import { getAiProviderConfig, saveAiProviderConfig } from '../../api/ai-provider';
import './index.less';

interface InputValueEvent {
  detail: {
    value: string;
  };
}

interface SwitchValueEvent {
  detail: {
    value: boolean;
  };
}

const AiProviderPage = (): JSX.Element => {
  const [provider, setProvider] = useState<string>('openai');
  const [baseUrl, setBaseUrl] = useState<string>('https://api.openai.com/v1');
  const [model, setModel] = useState<string>('gpt-4.1-mini');
  const [apiKey, setApiKey] = useState<string>('');
  const [enabled, setEnabled] = useState<boolean>(false);
  const [status, setStatus] = useState<string>('');

  useEffect((): void => {
    // 未授权用户访问该接口会返回 403，这里直接退回主控台。
    void getAiProviderConfig()
      .then((config): void => {
        if (!config) {
          return;
        }

        setProvider(config.provider);
        setBaseUrl(config.baseUrl);
        setModel(config.model);
        setEnabled(config.enabled);
      })
      .catch((): void => { void Taro.redirectTo({ url: '/pages/console/index' }); });
  }, []);

  const handleSave = async (): Promise<void> => {
    try {
      const nextApiKey = apiKey.trim();
      // apiKey 只在用户输入新值时提交，避免覆盖后端已有密钥。
      await saveAiProviderConfig({
        provider,
        baseUrl,
        model,
        enabled,
        ...(nextApiKey ? { apiKey: nextApiKey } : {}),
      });
      setStatus('SAVED');
    } catch {
      setStatus('FORBIDDEN');
    }
  };

  return (
    <View className="magi-page ai-provider-page">
      <Text className="ai-title">AI PROVIDER</Text>
      <Input className="ai-input" value={provider} onInput={(event: InputValueEvent): void => setProvider(event.detail.value)} />
      <Input className="ai-input" value={baseUrl} onInput={(event: InputValueEvent): void => setBaseUrl(event.detail.value)} />
      <Input className="ai-input" value={model} onInput={(event: InputValueEvent): void => setModel(event.detail.value)} />
      <Input className="ai-input" password value={apiKey} placeholder="apiKey" onInput={(event: InputValueEvent): void => setApiKey(event.detail.value)} />
      <View className="ai-switch">
        <Text>ENABLED</Text>
        <Switch checked={enabled} onChange={(event: SwitchValueEvent): void => setEnabled(event.detail.value)} />
      </View>
      <Button className="ai-button" onClick={handleSave}>SAVE</Button>
      {status ? <Text className="ai-status">{status}</Text> : null}
    </View>
  );
};

export default AiProviderPage;
