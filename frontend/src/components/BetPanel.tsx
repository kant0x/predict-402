import { useState } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';

const ORACLE_API = import.meta.env.VITE_ORACLE_API || 'http://localhost:3402';

interface BetPanelProps {
  upPool: number;
  downPool: number;
  onBet?: (direction: 'up' | 'down', amount: number) => void;
  nickname?: string;
}

const AMOUNTS = [0.001, 0.005, 0.01, 0.05];

const MODELS: { label: string; key: string }[] = [
  { label: 'Gemini 2.5 Flash', key: 'gemini-2.5-flash' },
  { label: 'GPT-4o', key: 'gpt-4o' },
  { label: 'GPT-4.1', key: 'gpt-4-1' },
  { label: 'Claude Sonnet', key: 'claude-sonnet' },
  { label: 'Grok 3', key: 'grok-3' },
];

export function BetPanel({ upPool, downPool, onBet, nickname }: BetPanelProps) {
  const { isConnected, address, chain: wagmiChain } = useAccount();
  const [selectedAmount, setSelectedAmount] = useState<number | null>(0.005);
  const [selectedModel, setSelectedModel] = useState(MODELS[0].key);
  const [oracleLoading, setOracleLoading] = useState(false);
  const [oracleResult, setOracleResult] = useState<{ direction: string; reason: string; model: string; payment_hash?: string; raw_output?: string } | null>(null);
  const [oracleError, setOracleError] = useState<string | null>(null);

  const handleBet = (direction: 'up' | 'down') => {
    if (!selectedAmount || !isConnected) return;
    onBet?.(direction, selectedAmount);
  };

  const handleAskOracle = async () => {
    if (!isConnected || !address) return;
    setOracleLoading(true);
    setOracleError(null);
    setOracleResult(null);
    try {
      const res = await fetch(`${ORACLE_API}/api/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player: address, model: selectedModel }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setOracleResult(data);
    } catch (err) {
      setOracleError(err instanceof Error ? err.message : 'Backend not available');
    } finally {
      setOracleLoading(false);
    }
  };

  const isWrongNetwork = wagmiChain && wagmiChain.id !== 10740;
  const canBet = isConnected && !!selectedAmount && !isWrongNetwork;

  return (
    <div className="card card--no-hover" style={{
      padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem',
      height: '100%', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.6rem', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ opacity: 0.7 }}>
            <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
          </svg>
          Place Your Prediction
        </div>
        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>On-chain</span>
      </div>

      {/* Pools */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <div style={{ background: 'rgba(91,138,114,0.05)', border: '1px solid rgba(91,138,114,0.12)', borderRadius: '8px', padding: '8px', textAlign: 'center' }}>
          <div style={{ fontSize: '0.6rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>UP POOL</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--accent-success)', fontWeight: 600 }}>{upPool.toFixed(4)} ETH</div>
        </div>
        <div style={{ background: 'rgba(199,80,80,0.05)', border: '1px solid rgba(199,80,80,0.12)', borderRadius: '8px', padding: '8px', textAlign: 'center' }}>
          <div style={{ fontSize: '0.6rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>DOWN POOL</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--accent-danger)', fontWeight: 600 }}>{downPool.toFixed(4)} ETH</div>
        </div>
      </div>

      {/* Oracle Row */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <select value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)}
          style={{ flex: 1, padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--bg-glass)', color: 'var(--text-secondary)', fontSize: '0.85rem', outline: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
        >
          {MODELS.map(m => <option key={m.key} value={m.key} style={{ background: '#141414' }}>{m.label}</option>)}
        </select>
        <button type="button" onClick={handleAskOracle} disabled={oracleLoading || !isConnected}
          style={{ padding: '9px 16px', borderRadius: '8px', border: '1px solid rgba(91,138,114,0.25)', background: 'rgba(91,138,114,0.08)', color: 'var(--accent-primary)', fontSize: '0.85rem', fontWeight: 600, cursor: oracleLoading ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap', fontFamily: 'inherit' }}
        >
          {oracleLoading ? 'Thinking...' : '⚡ Ask Oracle'}
        </button>
      </div>

      {/* AI Terminal */}
      <div style={{ flex: 1, minHeight: '60px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '7px 12px', borderBottom: '1px solid var(--border-subtle)', fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{
            width: '5px', height: '5px', borderRadius: '50%',
            background: oracleLoading ? 'var(--accent-primary)' : oracleResult ? 'var(--accent-success)' : 'var(--text-muted)',
            boxShadow: oracleLoading ? '0 0 6px var(--accent-primary-glow)' : 'none',
          }} />
          AI Oracle Terminal — x402 OpenGradient
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px', overflowY: 'auto' }}>
          {oracleLoading ? (
            <div style={{ textAlign: 'center', color: 'var(--accent-primary)' }}>
              <div style={{ width: '18px', height: '18px', margin: '0 auto 8px', border: '2px solid var(--accent-primary)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Connecting to TEE Node...</div>
            </div>
          ) : oracleResult ? (
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{
                  fontSize: '1rem', fontWeight: 700,
                  color: oracleResult.direction === 'UP' ? 'var(--accent-success)' : 'var(--accent-danger)',
                }}>
                  {oracleResult.direction === 'UP' ? '↑' : '↓'} {oracleResult.direction === 'UP' ? 'Bullish' : 'Bearish'}
                </span>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{oracleResult.model}</span>
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5, background: 'rgba(255,255,255,0.02)', padding: '8px', borderRadius: '6px' }}>
                {oracleResult.reason || oracleResult.raw_output || 'No additional details.'}
              </div>
              {oracleResult.payment_hash && (
                <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  x402: {oracleResult.payment_hash.slice(0, 16)}...
                </div>
              )}
            </div>
          ) : oracleError ? (
            <div style={{ color: 'var(--accent-danger)', fontSize: '0.8rem', textAlign: 'center' }}>
              ⚠ {oracleError}
            </div>
          ) : (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center', fontStyle: 'italic', opacity: 0.5 }}>
              Select a model and ask for a prediction.<br />Analysis will appear here.
            </div>
          )}
        </div>
      </div>

      {/* Bottom: Amount + Buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: 'rgba(0,0,0,0.15)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
        {/* Amount selector */}
        <div>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Amount (ETH)</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
            {AMOUNTS.map(a => (
              <button key={a} type="button" onClick={() => setSelectedAmount(a)}
                style={{
                  background: selectedAmount === a ? 'rgba(255,255,255,0.08)' : 'transparent',
                  border: selectedAmount === a ? '1px solid rgba(255,255,255,0.2)' : '1px solid rgba(255,255,255,0.06)',
                  color: selectedAmount === a ? '#fff' : '#888',
                  borderRadius: '20px', padding: '7px 0',
                  fontFamily: 'var(--font-mono)', fontSize: '0.78rem', cursor: 'pointer', transition: 'all 0.15s'
                }}
              >{a}</button>
            ))}
          </div>
        </div>

        {/* UP / DOWN buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <button type="button" onClick={() => handleBet('up')} disabled={!canBet}
            style={{
              padding: '13px', borderRadius: '10px', border: '1px solid rgba(91,138,114,0.3)',
              background: canBet ? 'rgba(91,138,114,0.12)' : 'rgba(255,255,255,0.02)',
              color: canBet ? 'var(--accent-success)' : 'var(--text-muted)',
              fontSize: '0.85rem', fontWeight: 700, cursor: canBet ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              textTransform: 'uppercase', letterSpacing: '0.06em', transition: 'all 0.2s',
              fontFamily: 'inherit',
            }}
            onMouseEnter={(e) => { if (canBet) e.currentTarget.style.background = 'rgba(91,138,114,0.22)'; }}
            onMouseLeave={(e) => { if (canBet) e.currentTarget.style.background = 'rgba(91,138,114,0.12)'; }}
          >
            {isWrongNetwork ? 'WRONG NETWORK' : !nickname ? 'SET NICKNAME' : '↑ UP'}
          </button>
          <button type="button" onClick={() => handleBet('down')} disabled={!canBet}
            style={{
              padding: '13px', borderRadius: '10px', border: '1px solid rgba(199,80,80,0.3)',
              background: canBet ? 'rgba(199,80,80,0.12)' : 'rgba(255,255,255,0.02)',
              color: canBet ? 'var(--accent-danger)' : 'var(--text-muted)',
              fontSize: '0.85rem', fontWeight: 700, cursor: canBet ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              textTransform: 'uppercase', letterSpacing: '0.06em', transition: 'all 0.2s',
              fontFamily: 'inherit',
            }}
            onMouseEnter={(e) => { if (canBet) e.currentTarget.style.background = 'rgba(199,80,80,0.22)'; }}
            onMouseLeave={(e) => { if (canBet) e.currentTarget.style.background = 'rgba(199,80,80,0.12)'; }}
          >
            {isWrongNetwork ? 'WRONG NETWORK' : !nickname ? 'SET NICKNAME' : '↓ DOWN'}
          </button>
        </div>

        {/* Connect wallet if not connected */}
        {!isConnected && (
          <ConnectButton.Custom>
            {({ openConnectModal }) => (
              <button onClick={openConnectModal} className="connect-wallet-fancy">
                <span className="connect-wallet-fancy__text">CONNECT WALLET</span>
              </button>
            )}
          </ConnectButton.Custom>
        )}
      </div>
    </div>
  );
}
