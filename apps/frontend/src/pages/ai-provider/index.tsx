import { useEffect, useState } from 'react';
import { Button, Input, Text, View } from '@tarojs/components';
import { getAiProviderConfig, saveAiProviderConfig } from '../../api/ai-provider';
import './index.less';

interface InputValueEvent {
  detail: {
    value: string;
  };
}

const AiProviderPage = (): JSX.Element => {
  const [apiKey, setApiKey] = useState<string>('');
  const [configured, setConfigured] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [status, setStatus] = useState<string>('');

  useEffect((): void => {
    void getAiProviderConfig()
      .then((config): void => {
        setConfigured(Boolean(config?.enabled && config.provider === 'deepseek' && config.baseUrl === 'https://api.deepseek.com'));
        setLoading(false);
      })
      .catch((): void => {
        setStatus('配置加载失败，请返回后重试');
      });
  }, []);


  const handleSave = async (): Promise<void> => {
    const nextApiKey = apiKey.trim();
    if (!nextApiKey && !configured) {
      setStatus('请填写 DeepSeek API Key');
      return;
    }
    if (saving || loading) return;

    setSaving(true);
    try {
      await saveAiProviderConfig({
        provider: 'deepseek',
        baseUrl: 'https://api.deepseek.com',
        model: 'deepseek-flash',
        enabled: true,
        ...(nextApiKey ? { apiKey: nextApiKey } : {}),
      });
      setApiKey('');
      setConfigured(true);
      setStatus('保存成功');
    } catch {
      setStatus('保存失败，请稍后重试');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View className="magi-page ai-provider-page">
      <Text className="ai-title">DEEPSEEK</Text>
      <Text className="ai-label">API KEY</Text>
      <Input
        className="ai-input"
        password
        value={apiKey}
        placeholder={configured ? '已配置，填写新密钥可替换' : '填写 DeepSeek API Key'}
        onInput={(event: InputValueEvent): void => setApiKey(event.detail.value)}
      />
      <Button className="ai-button" disabled={loading || saving} onClick={(): void => { void handleSave(); }}>
        {saving ? '保存中' : '保存'}
      </Button>
      {status ? <Text className="ai-status">{status}</Text> : null}
    </View>
  );
};

export default AiProviderPage;
