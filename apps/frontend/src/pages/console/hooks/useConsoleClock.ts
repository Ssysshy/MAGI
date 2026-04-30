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
    const timer = window.setInterval((): void => setClock(getClockText()), 30000);

    return (): void => window.clearInterval(timer);
  }, []);

  return clock;
};
