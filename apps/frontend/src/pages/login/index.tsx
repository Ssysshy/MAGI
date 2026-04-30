import { useState } from 'react';
import Taro from '@tarojs/taro';
import { Button, Input, Text, View } from '@tarojs/components';
import { login } from '../../api/auth';
import './index.less';

interface InputValueEvent {
  detail: {
    value: string;
  };
}

const LoginPage = (): JSX.Element => {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [error, setError] = useState<string>('');

  const handleLogin = async (): Promise<void> => {
    try {
      await login({ email, password });
      void Taro.redirectTo({ url: '/pages/console/index' });
    } catch {
      setError('登录失败');
    }
  };

  return (
    <View className="magi-page auth-page">
      <Text className="auth-title">MAGI 主控台</Text>
      <View className="auth-box">
        <Input className="auth-input" value={email} placeholder="email" onInput={(event: InputValueEvent): void => setEmail(event.detail.value)} />
        <Input className="auth-input" password value={password} placeholder="password" onInput={(event: InputValueEvent): void => setPassword(event.detail.value)} />
        {error ? <Text className="auth-error">{error}</Text> : null}
        <Button className="auth-button" onClick={handleLogin}>LOGIN</Button>
        <Text className="auth-link" onClick={(): void => { void Taro.redirectTo({ url: '/pages/register/index' }); }}>REGISTER</Text>
      </View>
    </View>
  );
};

export default LoginPage;
