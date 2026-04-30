import { useEffect, useState } from 'react';
import Taro from '@tarojs/taro';
import { Text, View } from '@tarojs/components';
import type { DecisionSession } from '@magi/shared';
import { listDecisionSessions } from '../../api/decision';
import './index.less';

const statusText: Record<string, string> = {
  approved: '认可',
  rejected: '否决',
  deferred: '延后',
  refused: '拒绝裁决',
};

const HistoryPage = (): JSX.Element => {
  const [sessions, setSessions] = useState<DecisionSession[]>([]);

  useEffect((): void => {
    void listDecisionSessions()
      .then((items: DecisionSession[]): void => setSessions(items))
      .catch((): void => { void Taro.redirectTo({ url: '/pages/login/index' }); });
  }, []);

  const openSession = (id: string): void => {
    void Taro.redirectTo({ url: `/pages/console/index?id=${id}` });
  };

  return (
    <View className="magi-page history-page">
      <Text className="history-title">DECISION HISTORY</Text>
      {sessions.map((session: DecisionSession): JSX.Element => (
        <View key={session.id} className="history-item" onClick={(): void => openSession(session.id)}>
          <Text className="history-question">{session.question}</Text>
          <Text className="history-status">{statusText[session.finalStatus]}</Text>
        </View>
      ))}
    </View>
  );
};

export default HistoryPage;
