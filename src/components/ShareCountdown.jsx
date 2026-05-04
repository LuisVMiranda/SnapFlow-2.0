import { useEffect, useState } from 'react';
import { formatRemainingCountdown } from '../lib/formatters';

export function ShareCountdown({ isoDate }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const expiresAt = new Date(isoDate).getTime();
  const diffMs = Math.max(0, expiresAt - now);
  const totalMinutes = Math.floor(diffMs / 60000);

  let color = '#00C851';
  if (totalMinutes <= 15) color = '#ffbb33';
  if (totalMinutes <= 10) color = '#ff4444';
  if (diffMs <= 0) color = '#888';

  return (
    <span
      style={{
        color,
        fontWeight: 'bold',
        fontSize: '1.2em',
        padding: '4px 8px',
        background: 'rgba(0,0,0,0.3)',
        borderRadius: '6px',
        border: `1px solid ${color}`,
        display: 'inline-block',
      }}
    >
      {formatRemainingCountdown(isoDate, now)}
    </span>
  );
}
