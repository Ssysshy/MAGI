import { useEffect, useState } from 'react';

const getClockText = (): string => {
  const now = new Date();
  const hour = `${now.getHours()}`.padStart(2, '0');
  const minute = `${now.getMinutes()}`.padStart(2, '0');

  return `${hour}:${minute}`;
};

export const useConsoleClock = (): string => {
  const [clock, setClock] = useState<string>(getClockText);

  useEffect((): (() => void) => {
    // 主控台只需要分钟级刷新，避免秒级计时造成无意义重渲染。
    const timer = setInterval((): void => setClock(getClockText()), 30000);

    return (): void => clearInterval(timer);
  }, []);

  return clock;
};
