import { useState } from 'react';
import Taro from '@tarojs/taro';
import { Button, Input, Text, View } from '@tarojs/components';
import { register } from '../../api/auth';
import '../login/index.less';

interface InputValueEvent {
  detail: {
    value: string;
  };
}

const RegisterPage = (): JSX.Element => {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [error, setError] = useState<string>('');

  const handleRegister = async (): Promise<void> => {
    try {
      await register({ email, password });
      void Taro.redirectTo({ url: '/pages/console/index' });
    } catch {
      setError('注册失败');
    }
  };

  return (
    <View className="magi-page auth-page">
      <Text className="auth-title">MAGI REGISTER</Text>
      <View className="auth-box">
        <Input className="auth-input" value={email} placeholder="email" onInput={(event: InputValueEvent): void => setEmail(event.detail.value)} />
        <Input className="auth-input" password value={password} placeholder="password" onInput={(event: InputValueEvent): void => setPassword(event.detail.value)} />
        {error ? <Text className="auth-error">{error}</Text> : null}
        <Button className="auth-button" onClick={handleRegister}>REGISTER</Button>
        <Text className="auth-link" onClick={(): void => { void Taro.redirectTo({ url: '/pages/login/index' }); }}>LOGIN</Text>
      </View>
    </View>
  );
};

export default RegisterPage;
