import { useState, useEffect, useCallback } from 'react';

interface TimerProps {
    targetTimestamp: number;
    onExpire?: () => void;
}

export function Timer({ targetTimestamp, onExpire }: TimerProps) {
    const calcRemaining = useCallback(() => {
        const now = Math.floor(Date.now() / 1000);
        return Math.max(0, targetTimestamp - now);
    }, [targetTimestamp]);

    const [remaining, setRemaining] = useState(calcRemaining);

    useEffect(() => {
        setRemaining(calcRemaining());
        const interval = setInterval(() => {
            const r = calcRemaining();
            setRemaining(r);
            if (r <= 0) { clearInterval(interval); onExpire?.(); }
        }, 1000);
        return () => clearInterval(interval);
    }, [targetTimestamp, calcRemaining, onExpire]);

    if (!targetTimestamp) {
        return (
            <div className="timer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Syncing...</span>
            </div>
        );
    }

    if (remaining <= 0) {
        return (
            <div className="timer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.15em', animation: 'pulse 1.5s infinite' }}>Resolving Round...</span>
            </div>
        );
    }

    const hours = Math.floor(remaining / 3600);
    const minutes = Math.floor((remaining % 3600) / 60);
    const seconds = remaining % 60;
    const pad = (n: number) => n.toString().padStart(2, '0');

    return (
        <div className={`timer${remaining < 30 ? ' timer--urgent' : ''}`}>
            <div className="timer__unit">
                <div className="timer__value">{pad(hours)}</div>
                <span className="timer__label">hours</span>
            </div>
            <span className="timer__separator">:</span>
            <div className="timer__unit">
                <div className="timer__value">{pad(minutes)}</div>
                <span className="timer__label">min</span>
            </div>
            <span className="timer__separator">:</span>
            <div className="timer__unit">
                <div className="timer__value">{pad(seconds)}</div>
                <span className="timer__label">sec</span>
            </div>
        </div>
    );
}
