import { useState, useEffect } from 'react';

interface RoundTimerProps {
  roundId: number;
  endTime: number; // unix ms
}

export function RoundTimer({ roundId, endTime }: RoundTimerProps) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    const tick = () => {
      const diff = Math.max(0, endTime - Date.now());
      setRemaining(diff);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endTime]);

  const totalSec = Math.floor(remaining / 1000);
  const hours = String(Math.floor(totalSec / 3600)).padStart(2, '0');
  const minutes = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0');
  const seconds = String(totalSec % 60).padStart(2, '0');
  const isUrgent = totalSec <= 30 && totalSec > 0;

  return (
    <div className="card card--no-hover" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '16px', background: '#111' }}>
      <div style={{ fontSize: '0.65rem', fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '16px' }}>
        ROUND #{roundId || '...'}
      </div>
      <div className={`timer ${isUrgent ? 'timer--urgent' : ''}`} style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '2rem', fontWeight: 700, color: '#e8e8e8', lineHeight: 1 }}>{hours}</div>
          <div style={{ fontSize: '0.55rem', fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: '0.1em' }}>HOURS</div>
        </div>

        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.5rem', fontWeight: 500, color: '#555', transform: 'translateY(-8px)' }}>:</div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '2rem', fontWeight: 700, color: '#e8e8e8', lineHeight: 1 }}>{minutes}</div>
          <div style={{ fontSize: '0.55rem', fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: '0.1em' }}>MIN</div>
        </div>

        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.5rem', fontWeight: 500, color: '#555', transform: 'translateY(-8px)' }}>:</div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '2rem', fontWeight: 700, color: '#e8e8e8', lineHeight: 1 }}>{seconds}</div>
          <div style={{ fontSize: '0.55rem', fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: '0.1em' }}>SEC</div>
        </div>
      </div>
    </div>
  );
}
