import { useState, useEffect, useCallback, useRef } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { formatEther } from 'viem';
import { useDeposit, ORACLE_API } from '../context/DepositContext';
import { DepositModal } from '../components/DepositModal';
import { Timer } from '../components/Timer';
import { ChartCard } from '../components/ChartCard';
import { useCurrentRoundId, useRoundEndTime, useStrikePrice, useUpPool, useDownPool } from '../hooks/useContract';
import { subscribeToRawPrice } from '../hooks/useBtcPrice';
import { VAULT402_ADDRESS } from '../config/contracts';

const VAULT402_DEPOSIT_ABI = [
  { type: 'function', name: 'balances', inputs: [{ name: '', type: 'address' }], outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view' }
] as const;

interface BotStatus {
  running: boolean;
  wins: number;
  losses: number;
  logs: { time: string; round: number; direction: string; confidence: number; amount: number; result?: string }[];
}

const emptyStatus: BotStatus = { running: false, wins: 0, losses: 0, logs: [] };
const BET_OPTIONS = [0.001, 0.005, 0.01];

const formatPrice = (p: number | null) =>
  p ? p.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }) : '$—';

export function BitQuantPage() {
  const { address, isConnected } = useAccount();
  const { depositAddress, balances } = useDeposit();

  // Market data (same as GamePage)
  const [btcPrice, setBtcPrice] = useState<number | null>(null);
  const { roundId } = useCurrentRoundId();
  const { endTime } = useRoundEndTime();
  const { strikePrice } = useStrikePrice();
  const { upPool } = useUpPool();
  const { downPool } = useDownPool();

  const { data: vaultBalance } = useReadContract({
    address: VAULT402_ADDRESS, abi: VAULT402_DEPOSIT_ABI, functionName: 'balances',
    args: address && isConnected ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 15_000 },
  });
  const balanceFormatted = vaultBalance ? formatEther(vaultBalance as bigint) : '0';

  useEffect(() => {
    const unsub = subscribeToRawPrice((price) => setBtcPrice(price));
    return unsub;
  }, []);

  const upPoolEth = upPool ? parseFloat(formatEther(upPool as bigint)) : 0;
  const downPoolEth = downPool ? parseFloat(formatEther(downPool as bigint)) : 0;

  // Bot state
  const [status, setStatus] = useState<BotStatus>(emptyStatus);
  const [maxBet, setMaxBet] = useState(0.01);
  const [isToggling, setIsToggling] = useState(false);
  const [depositOpen, setDepositOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [status.logs]);

  const fetchStatus = useCallback(async () => {
    if (!address) return;
    try {
      const res = await fetch(`${ORACLE_API}/api/bot/status?player=${address}&bot_id=bitquant`);
      if (res.ok) {
        const data = await res.json();
        setStatus({
          running: data.running ?? false,
          wins: data.wins ?? 0,
          losses: data.losses ?? 0,
          logs: data.logs ?? [],
        });
      }
    } catch { /* silent */ }
  }, [address]);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 15_000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const handleToggle = async () => {
    if (!address) return;
    setIsToggling(true);
    try {
      if (status.running) {
        await fetch(`${ORACLE_API}/api/bot/stop`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ player: address, bot_id: 'bitquant' }),
        });
      } else {
        await fetch(`${ORACLE_API}/api/bot/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            player: address, bot_id: 'bitquant',
            max_bet_eth: maxBet, strategy: 'ml', model: 'btc_xgboost',
          }),
        });
      }
      await fetchStatus();
    } catch (e) {
      console.error('BitQuant toggle error:', e);
    } finally {
      setIsToggling(false);
    }
  };

  const handleCopy = () => {
    if (depositAddress) {
      navigator.clipboard.writeText(depositAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const total = status.wins + status.losses;
  const winRate = total > 0 ? ((status.wins / total) * 100).toFixed(1) : '—';

  if (!isConnected) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        height: 'calc(100vh - 64px)', background: '#0a0a0a', gap: '16px',
      }}>
        <div style={{ fontSize: '2.5rem' }}>⚡</div>
        <div style={{ fontSize: '1.1rem', color: 'var(--text-primary)', fontWeight: 600 }}>BitQuant Trading</div>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Connect your wallet to start automated ML trading</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', height: 'calc(100vh - 64px)', padding: '16px 32px 32px', overflow: 'hidden', background: '#0a0a0a' }}>

      {/* TOP ROW: Prices (left) + Timer (right) — same as GamePage */}
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
            <span>Pool: <strong style={{ color: 'var(--accent-gold)' }}>{(upPoolEth + downPoolEth).toFixed(4)} ETH</strong></span>
          </div>
        </div>
      </div>

      {/* BOTTOM ROW: Chart (left) + Bot Panel (right) */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '12px', minHeight: 0, overflow: 'hidden' }}>

        {/* Chart */}
        <div style={{ minHeight: 0, overflow: 'hidden' }}>
          <ChartCard strikePrice={strikePrice || 0} />
        </div>

        {/* Bot Control Panel */}
        <div className="card card--no-hover" style={{
          padding: '20px', display: 'flex', flexDirection: 'column',
          overflow: 'hidden', minHeight: 0, height: '100%',
        }}>
          {/* Bot Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: '16px', flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '10px',
                background: status.running
                  ? 'linear-gradient(135deg, rgba(91, 138, 114, 0.2), rgba(91, 138, 114, 0.05))'
                  : 'rgba(255,255,255,0.04)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.1rem',
                border: status.running
                  ? '1px solid rgba(91, 138, 114, 0.2)'
                  : '1px solid rgba(255,255,255,0.06)',
                transition: 'all 0.3s',
              }}>⚡</div>
              <div>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>BitQuant</div>
                <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>ML Prediction Bot</div>
              </div>
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              padding: '4px 10px', borderRadius: '16px',
              background: status.running ? 'rgba(91, 138, 114, 0.1)' : 'rgba(255,255,255,0.03)',
              border: status.running ? '1px solid rgba(91, 138, 114, 0.2)' : '1px solid rgba(255,255,255,0.06)',
            }}>
              <div style={{
                width: '6px', height: '6px', borderRadius: '50%',
                background: status.running ? 'var(--accent-success)' : '#555',
                boxShadow: status.running ? '0 0 8px var(--accent-success)' : 'none',
                animation: status.running ? 'pulse 2s infinite' : 'none',
              }} />
              <span style={{ fontSize: '0.65rem', fontWeight: 600, color: status.running ? 'var(--accent-success)' : 'var(--text-muted)' }}>
                {status.running ? 'ACTIVE' : 'OFF'}
              </span>
            </div>
          </div>

          {/* Scrollable content */}
          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>

            {/* Model Badge */}
            <div style={{
              padding: '10px 12px', borderRadius: '8px',
              background: 'rgba(196, 163, 90, 0.04)',
              border: '1px solid rgba(196, 163, 90, 0.08)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                <span style={{
                  padding: '1px 6px', borderRadius: '3px', fontSize: '0.55rem', fontWeight: 700,
                  background: 'rgba(196, 163, 90, 0.15)', color: 'var(--accent-gold)',
                  textTransform: 'uppercase', letterSpacing: '0.08em',
                }}>ML</span>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>BTC XGBoost</span>
              </div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                1hr return prediction · 24 hourly candles
              </div>
            </div>

            {/* Vault402 Balance */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.04)',
            }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>Vault402 Balance</span>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                {parseFloat(balanceFormatted).toFixed(4)} ETH
              </span>
            </div>

            {/* Max Bet Per Round */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                MAX BET PER ROUND
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                {BET_OPTIONS.map(v => (
                  <button
                    key={v}
                    onClick={() => setMaxBet(v)}
                    disabled={status.running}
                    style={{
                      padding: '10px 4px', borderRadius: '6px', cursor: status.running ? 'not-allowed' : 'pointer',
                      background: maxBet === v ? 'rgba(91, 138, 114, 0.1)' : 'rgba(255,255,255,0.02)',
                      border: maxBet === v ? '1px solid var(--accent-success)' : '1px solid rgba(255,255,255,0.06)',
                      color: maxBet === v ? 'var(--accent-success)' : 'var(--text-muted)',
                      fontSize: '0.75rem', fontWeight: 600, fontFamily: 'var(--font-mono)',
                      transition: 'all 0.2s', opacity: status.running ? 0.6 : 1,
                    }}
                  >
                    {v} ETH
                  </button>
                ))}
              </div>
            </div>

            {/* Live Reasoning Terminal */}
            <div style={{
              display: 'flex', flexDirection: 'column',
              background: 'rgba(12, 12, 12, 0.75)',
              border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px',
              overflow: 'hidden', flex: 1, minHeight: '150px'
            }}>
              <div style={{
                padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)',
                fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)',
                letterSpacing: '0.1em', textTransform: 'uppercase'
              }}>
                Live Reasoning
              </div>
              <div style={{
                flex: 1, padding: '12px 14px', overflowY: 'auto',
                fontFamily: 'var(--font-mono)', fontSize: '0.7rem', lineHeight: 1.6,
                display: 'flex', flexDirection: 'column',
                justifyContent: status.logs.length === 0 ? 'center' : 'flex-start',
              }} className="custom-scrollbar">
                {status.logs.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontStyle: 'italic', fontWeight: 500 }}>
                    <div>OpenGradient BTC XGBoost initialized.</div>
                    <div style={{ marginTop: '4px' }}>{status.running ? 'Awaiting next candle...' : 'Waiting for start command...'}</div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {status.logs.map((log, i) => {
                      const color = log.result === 'WIN' ? 'var(--accent-success)'
                        : log.result === 'LOSS' ? '#c75050'
                          : log.direction === 'SKIP' ? 'var(--text-muted)'
                            : 'var(--text-primary)';
                      return (
                        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.6rem' }}>
                            [{log.time}] Round #{log.round}
                          </span>
                          <span style={{ color }}>
                            {log.direction !== 'SKIP'
                              ? `Predicted ${log.direction} (${log.confidence}%). Bet: ${log.amount}ETH.`
                              : `Confidence ${log.confidence}% too low. Action: SKIP.`}
                            {log.result && ` Result: ${log.result}`}
                          </span>
                        </div>
                      )
                    })}
                    {status.running && (
                      <div style={{ display: 'flex', gap: '8px', marginTop: '8px', color: 'var(--text-muted)', opacity: 0.6, animation: 'pulse 2s infinite' }}>
                        <span>Analyzing live features for next epoch...</span>
                      </div>
                    )}
                    <div ref={logsEndRef} />
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Start/Stop Button (pinned bottom) */}
          <button
            onClick={handleToggle}
            disabled={isToggling}
            style={{
              width: '100%', padding: '12px', borderRadius: '8px', cursor: isToggling ? 'wait' : 'pointer',
              marginTop: '12px', flexShrink: 0,
              background: status.running
                ? 'rgba(199, 80, 80, 0.12)'
                : 'linear-gradient(135deg, rgba(91, 138, 114, 0.15), rgba(91, 138, 114, 0.08))',
              border: status.running
                ? '1px solid rgba(199, 80, 80, 0.3)'
                : '1px solid rgba(91, 138, 114, 0.3)',
              color: status.running ? '#c75050' : 'var(--accent-success)',
              fontSize: '0.9rem', fontWeight: 700, fontFamily: 'inherit',
              transition: 'all 0.2s', letterSpacing: '0.02em',
              opacity: isToggling ? 0.6 : 1,
            }}
          >
            {isToggling ? 'Processing...' : status.running ? 'STOP BOT' : 'START BOT'}
          </button>
        </div>
      </div>

      <DepositModal isOpen={depositOpen} onClose={() => setDepositOpen(false)} depositAddress={depositAddress} />
    </div>
  );
}
