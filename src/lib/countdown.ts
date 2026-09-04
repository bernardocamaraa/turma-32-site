import { useEffect, useState } from 'react';

export const BAILE = new Date(2026, 11, 10, 19, 0, 0);

export type Countdown = {
  dias: string;
  horas: string;
  min: string;
  seg: string;
};

const pad = (n: number) => String(n).padStart(2, '0');

function computeCountdown(): Countdown {
  const ms = Math.max(0, BAILE.getTime() - Date.now());
  return {
    dias: String(Math.floor(ms / 86400000)),
    horas: pad(Math.floor(ms / 3600000) % 24),
    min: pad(Math.floor(ms / 60000) % 60),
    seg: pad(Math.floor(ms / 1000) % 60),
  };
}

export function useCountdown(): Countdown {
  const [value, setValue] = useState(computeCountdown);

  useEffect(() => {
    const id = setInterval(() => setValue(computeCountdown()), 1000);
    return () => clearInterval(id);
  }, []);

  return value;
}
