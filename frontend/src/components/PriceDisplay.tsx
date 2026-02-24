import { useEffect } from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';

interface PriceDisplayProps {
    price: number | null;
    change24h?: number;
}

export function PriceDisplay({ price, change24h }: PriceDisplayProps) {
    const springPrice = useSpring(price || 0, { stiffness: 75, damping: 18, mass: 0.8 });
    const displayPrice = useTransform(springPrice, (latest) => {
        return latest.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
    });

    useEffect(() => { if (price !== null) springPrice.set(price); }, [price, springPrice]);

    return (
        <div className="price-display">
            <span className="price-display__label">Current BTC Price</span>
            <motion.div className="price-display__value" style={{ display: 'inline-block' }}>{displayPrice}</motion.div>
            {change24h !== undefined && (
                <div className={`price-display__change ${change24h >= 0 ? 'price-display__change--up' : 'price-display__change--down'}`}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        {change24h >= 0 ? <polyline points="18 15 12 9 6 15" /> : <polyline points="6 9 12 15 18 9" />}
                    </svg>
                    <span>{Math.abs(change24h).toFixed(2)}% (24h)</span>
                </div>
            )}
            <div style={{ marginTop: '6px', fontSize: '0.65rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'center' }}>
                <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--accent-success)', display: 'inline-block', boxShadow: '0 0 4px var(--accent-success)', animation: 'pulse 2s infinite' }} />
                via OpenGradient Oracle
            </div>
        </div>
    );
}
