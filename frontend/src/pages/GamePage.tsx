import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { formatEther } from 'viem';
import { Timer } from '../components/Timer';
import { BetPanel } from '../components/BetPanel';
import { ChartCard } from '../components/ChartCard';
import { useCurrentRoundId, useRoundEndTime, useStrikePrice, useUpPool, useDownPool } from '../hooks/useContract';
import { subscribeToRawPrice } from '../hooks/useBtcPrice';

interface HomePageProps {
  nickname: string;
  onPlaceBet: (isUp: boolean, amount: string) => void;
  bets: any[];
  isLoading: boolean;
}

const formatPrice = (p: number | null) =>
  p ? p.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }) : '$—';

export function HomePage({ nickname, onPlaceBet, bets, isLoading }: HomePageProps) {
  const { isConnected } = useAccount();
  const [btcPrice, setBtcPrice] = useState<number | null>(null);
  const { roundId } = useCurrentRoundId();
  const { endTime } = useRoundEndTime();
  const { strikePrice } = useStrikePrice();
  const { upPool } = useUpPool();
  const { downPool } = useDownPool();

  useEffect(() => {
    const unsub = subscribeToRawPrice((price) => {
      setBtcPrice(price);
    });
    return unsub;
  }, []);

  const upPoolEth = upPool ? parseFloat(formatEther(upPool as bigint)) : 0;
  const downPoolEth = downPool ? parseFloat(formatEther(downPool as bigint)) : 0;

  const handleBet = (direction: 'up' | 'down', amount: number) => {
    onPlaceBet(direction === 'up', amount.toString());
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', height: 'calc(100vh - 64px)', padding: '16px 32px 32px', overflow: 'hidden', background: '#0a0a0a' }}>

      {/* TOP ROW: Prices (left, wide) + Timer (right, narrow) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '12px', flexShrink: 0 }}>

        {/* Strike + Current Price */}
        <div className="card card--no-hover" style={{ padding: 0 }}>
          <div style={{ display: 'flex', height: '100%' }}>
            <div style={{ flex: 1, padding: '1.2rem 1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRight: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>Strike Price</div>
              <div style={{ fontSize: '2.4rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', letterSpacing: '-0.02em', lineHeight: 1 }}>{formatPrice(strikePrice)}</div>
            </div>
            <div style={{ flex: 1, padding: '1.2rem 1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                Current BTC Price
                <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--accent-success)', display: 'inline-block', boxShadow: '0 0 4px var(--accent-success)', animation: 'pulse 2s infinite' }} />
              </div>
              <div style={{ fontSize: '2.4rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', letterSpacing: '-0.02em', lineHeight: 1 }}>{formatPrice(btcPrice)}</div>
            </div>
          </div>
        </div>

        {/* Round Timer */}
        <div className="card card--no-hover" style={{ padding: '1.2rem 1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent-success)', boxShadow: '0 0 6px var(--accent-success)', animation: 'pulse 2s infinite' }} />
            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>Round #{roundId || '—'}</span>
          </div>
          <Timer targetTimestamp={endTime || 0} />
          <div style={{ display: 'flex', gap: '14px', marginTop: '6px', fontSize: '0.65rem', color: 'var(--text-muted)' }}>
            <span>Bets: <strong style={{ color: 'var(--text-secondary)' }}>{bets.length}</strong></span>
            <span>Pool: <strong style={{ color: 'var(--accent-gold)' }}>{(upPoolEth + downPoolEth).toFixed(4)} ETH</strong></span>
          </div>
        </div>
      </div>

      {/* BOTTOM ROW: Chart (left, wide) + BetPanel (right, narrow) */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '12px', minHeight: 0, overflow: 'hidden' }}>

        {/* Chart */}
        <div style={{ minHeight: 0, overflow: 'hidden' }}>
          <ChartCard strikePrice={strikePrice || 0} />
        </div>

        <div style={{ minHeight: 0, overflow: 'hidden' }}>
          <BetPanel
            upPool={upPoolEth}
            downPool={downPoolEth}
            onBet={handleBet}
            nickname={nickname}
          />
        </div>
      </div>
    </div>
  );
}
