import { useState } from 'react';
import type { BotConfig, BotStatus } from './BotCard';

const LLM_MODELS = [
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'gpt-4-1', label: 'GPT-4.1' },
  { value: 'o4-mini', label: 'O4 Mini' },
  { value: 'claude-sonnet', label: 'Claude 4.0 Sonnet' },
  { value: 'claude-haiku', label: 'Claude 3.5 Haiku' },
  { value: 'grok-3', label: 'Grok 3 Beta' },
  { value: 'grok-4-1', label: 'Grok 4.1 Fast' },
];

const ML_MODELS = [
  { value: 'btc_xgboost', label: 'BTC XGBoost — 1hr return prediction' },
];

const BET_OPTIONS = [0.001, 0.005, 0.01, 0.05];

const DEFAULT_PROMPT = `You are a cryptocurrency trading analyst specializing in Bitcoin.
Analyze current BTC/USDT market conditions and predict whether
Bitcoin will go UP or DOWN in the next 5 minutes.

Consider: recent price momentum, volatility patterns, support/resistance levels.

Respond with EXACTLY this JSON format:
{"direction": "UP" or "DOWN", "confidence": 0-100, "reason": "brief explanation"}`;

interface BotConfigPanelProps {
  bot: BotConfig;
  status: BotStatus;
  balance: { eth: number; ousdc: number };
  depositAddress: string | null;
  onSave: (updated: BotConfig) => void;
  onStart: () => void;
  onStop: () => void;
  onDelete: () => void;
  onClose: () => void;
}

export function BotConfigPanel({ bot, status, balance, depositAddress, onSave, onStart, onStop, onDelete, onClose }: BotConfigPanelProps) {
  const [cfg, setCfg] = useState<BotConfig>({ ...bot });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [copied, setCopied] = useState(false);

  const update = <K extends keyof BotConfig>(key: K, val: BotConfig[K]) => {
    setCfg(prev => ({ ...prev, [key]: val }));
  };

  const handleCopy = () => {
    if (depositAddress) {
      navigator.clipboard.writeText(depositAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const sectionStyle: React.CSSProperties = {
    marginBottom: '24px',
  };

  const sectionTitle: React.CSSProperties = {
    fontSize: '0.7rem', fontWeight: 600, color: 'var(--accent-gold)',
    textTransform: 'uppercase', letterSpacing: '0.1em',
    marginBottom: '12px', paddingBottom: '6px',
    borderBottom: '1px solid rgba(196, 163, 90, 0.1)',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px',
    display: 'block',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 12px', borderRadius: '6px',
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
    color: 'var(--text-primary)', fontSize: '0.85rem', fontFamily: 'inherit',
    outline: 'none', boxSizing: 'border-box',
  };

  const selectStyle: React.CSSProperties = {
    ...inputStyle, cursor: 'pointer', appearance: 'auto' as React.CSSProperties['appearance'],
  };

  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid rgba(196, 163, 90, 0.15)',
      borderRadius: '12px', padding: '24px', marginTop: '12px',
      position: 'relative',
    }}>
      {/* Close button */}
      <button onClick={onClose} style={{
        position: 'absolute', top: '12px', right: '12px',
        background: 'transparent', border: 'none', cursor: 'pointer',
        color: 'var(--text-muted)', fontSize: '1.2rem', padding: '4px 8px',
        fontFamily: 'inherit',
      }}>✕</button>

      {/* Bot Name */}
      <div style={sectionStyle}>
        <label style={labelStyle}>Bot Name</label>
        <input
          value={cfg.name}
          onChange={e => update('name', e.target.value)}
          style={inputStyle}
          maxLength={32}
        />
      </div>

      {/* ── AI Model ── */}
      <div style={sectionStyle}>
        <div style={sectionTitle}>AI Model</div>

        {/* Strategy toggle */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          {(['llm', 'ml'] as const).map(s => (
            <button key={s} onClick={() => {
              update('strategy', s);
              if (s === 'ml') update('model', 'btc_xgboost');
              else if (s === 'llm' && cfg.model === 'btc_xgboost') update('model', 'gemini-2.5-flash');
            }} style={{
              padding: '8px 20px', borderRadius: '6px', cursor: 'pointer',
              background: cfg.strategy === s ? 'rgba(91, 138, 114, 0.12)' : 'transparent',
              border: cfg.strategy === s ? '1px solid rgba(91, 138, 114, 0.3)' : '1px solid rgba(255,255,255,0.08)',
              color: cfg.strategy === s ? 'var(--accent-success)' : 'var(--text-secondary)',
              fontSize: '0.8rem', fontWeight: 600, fontFamily: 'inherit',
              transition: 'all 0.2s',
            }}>
              {s === 'llm' ? 'LLM Oracle' : 'ML Prediction'}
            </button>
          ))}
        </div>

        {cfg.strategy === 'llm' ? (
          <>
            {/* LLM Model select */}
            <label style={labelStyle}>Model</label>
            <select value={cfg.model} onChange={e => update('model', e.target.value)} style={{ ...selectStyle, marginBottom: '12px' }}>
              {LLM_MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>

            {/* Temperature */}
            <label style={labelStyle}>Temperature: <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{cfg.temperature.toFixed(1)}</span></label>
            <input
              type="range" min="0" max="1" step="0.1"
              value={cfg.temperature}
              onChange={e => update('temperature', parseFloat(e.target.value))}
              style={{ width: '100%', marginBottom: '12px', accentColor: 'var(--accent-success)' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '12px', marginTop: '-8px' }}>
              <span>Precise</span><span>Creative</span>
            </div>

            {/* Max Tokens */}
            <label style={labelStyle}>Max Tokens</label>
            <input
              type="number" min={50} max={500} step={10}
              value={cfg.maxTokens}
              onChange={e => update('maxTokens', Math.min(500, Math.max(50, parseInt(e.target.value) || 100)))}
              style={{ ...inputStyle, marginBottom: '12px', width: '120px' }}
            />

            {/* System Prompt */}
            <label style={labelStyle}>System Prompt</label>
            <textarea
              value={cfg.systemPrompt}
              onChange={e => update('systemPrompt', e.target.value)}
              rows={8}
              style={{
                ...inputStyle, fontFamily: 'var(--font-mono)', fontSize: '0.75rem',
                resize: 'vertical', lineHeight: 1.5,
              }}
            />
          </>
        ) : (
          <div style={{
            padding: '12px 16px', borderRadius: '8px',
            background: 'rgba(196, 163, 90, 0.05)',
            border: '1px solid rgba(196, 163, 90, 0.1)',
          }}>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.85rem', marginBottom: '4px' }}>
              BTC XGBoost
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              1-hour return prediction using 24 hourly candles.
              Model: <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem' }}>shoeiico/og_btcusdt_1hour_return_xgb</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Betting Strategy ── */}
      <div style={sectionStyle}>
        <div style={sectionTitle}>Betting Strategy</div>

        <label style={labelStyle}>Max Bet per Round</label>
        <select
          value={cfg.maxBetEth}
          onChange={e => update('maxBetEth', parseFloat(e.target.value))}
          style={{ ...selectStyle, marginBottom: '12px', width: '180px' }}
        >
          {BET_OPTIONS.map(v => <option key={v} value={v}>{v} ETH</option>)}
        </select>

        <label style={labelStyle}>
          Min Confidence: <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{cfg.minConfidence}%</span>
        </label>
        <input
          type="range" min={50} max={100} step={1}
          value={cfg.minConfidence}
          onChange={e => update('minConfidence', parseInt(e.target.value))}
          style={{ width: '100%', marginBottom: '12px', accentColor: 'var(--accent-gold)' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '16px', marginTop: '-8px' }}>
          <span>50% — Aggressive</span><span>100% — Ultra Safe</span>
        </div>

        {/* Bet Scaling */}
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: 'var(--accent-success)' }}>Confidence ≥75%:</span>
            <select value={cfg.betScaling.high} onChange={e => update('betScaling', { ...cfg.betScaling, high: parseInt(e.target.value) })} style={{ ...selectStyle, width: '80px', padding: '4px 8px' }}>
              {[100, 75, 50, 25].map(v => <option key={v} value={v}>{v}%</option>)}
            </select>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>of max bet</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: 'var(--accent-gold)' }}>Confidence 60-74%:</span>
            <select value={cfg.betScaling.mid} onChange={e => update('betScaling', { ...cfg.betScaling, mid: parseInt(e.target.value) })} style={{ ...selectStyle, width: '80px', padding: '4px 8px' }}>
              {[100, 75, 50, 25].map(v => <option key={v} value={v}>{v}%</option>)}
            </select>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>of max bet</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: '#c75050' }}>Confidence &lt;60%:</span>
            <select value={cfg.betScaling.low} onChange={e => update('betScaling', { ...cfg.betScaling, low: parseInt(e.target.value) })} style={{ ...selectStyle, width: '80px', padding: '4px 8px' }}>
              {[25, 0].map(v => <option key={v} value={v}>{v === 0 ? 'Skip' : `${v}%`}</option>)}
            </select>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>{cfg.betScaling.low === 0 ? 'skip round' : 'of max bet'}</span>
          </div>
        </div>
      </div>

      {/* ── Deposit Wallet ── */}
      <div style={sectionStyle}>
        <div style={sectionTitle}>Deposit Wallet</div>
        {depositAddress ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-secondary)',
                overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {depositAddress}
              </span>
              <button onClick={handleCopy} style={{
                padding: '4px 10px', borderRadius: '4px', cursor: 'pointer',
                background: copied ? 'rgba(91, 138, 114, 0.15)' : 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: copied ? 'var(--accent-success)' : 'var(--text-secondary)',
                fontSize: '0.7rem', fontFamily: 'inherit', transition: 'all 0.2s',
              }}>{copied ? 'Copied!' : 'Copy'}</button>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
              <span style={{ color: 'var(--text-primary)' }}>{balance.eth.toFixed(4)}</span> ETH
              <span style={{ margin: '0 8px', color: 'var(--text-muted)' }}>|</span>
              <span style={{ color: 'var(--text-primary)' }}>{balance.ousdc.toFixed(2)}</span> OUSDC
            </div>
          </>
        ) : (
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Connect wallet to see deposit address</div>
        )}
      </div>

      {/* ── Live Log ── */}
      {status.logs.length > 0 && (
        <div style={sectionStyle}>
          <div style={sectionTitle}>Live Log</div>
          <div style={{
            maxHeight: '180px', overflowY: 'auto',
            background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '10px 12px',
            fontFamily: 'var(--font-mono)', fontSize: '0.7rem', lineHeight: 1.8,
          }}>
            {status.logs.slice(-20).reverse().map((log, i) => {
              const color = log.result === 'WIN' ? 'var(--accent-success)'
                : log.result === 'LOSS' ? '#c75050'
                : log.direction === 'SKIP' ? 'var(--text-muted)'
                : 'var(--accent-gold)';
              return (
                <div key={i} style={{ color }}>
                  {log.time} Round #{log.round} → {log.direction}
                  {log.direction !== 'SKIP' && ` (conf: ${log.confidence}%) ${log.amount} ETH`}
                  {log.direction === 'SKIP' && ` (conf: ${log.confidence}%)`}
                  {log.result && ` [${log.result}]`}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Action Buttons ── */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button onClick={() => onSave(cfg)} style={{
          padding: '10px 24px', borderRadius: '6px', cursor: 'pointer',
          background: 'rgba(91, 138, 114, 0.12)', border: '1px solid rgba(91, 138, 114, 0.3)',
          color: 'var(--accent-success)', fontSize: '0.85rem', fontWeight: 600,
          fontFamily: 'inherit', transition: 'all 0.2s',
        }}>Save Config</button>

        {status.running ? (
          <button onClick={onStop} style={{
            padding: '10px 24px', borderRadius: '6px', cursor: 'pointer',
            background: 'rgba(199, 80, 80, 0.12)', border: '1px solid rgba(199, 80, 80, 0.3)',
            color: '#c75050', fontSize: '0.85rem', fontWeight: 600,
            fontFamily: 'inherit', transition: 'all 0.2s',
          }}>Stop Bot</button>
        ) : (
          <button onClick={onStart} style={{
            padding: '10px 24px', borderRadius: '6px', cursor: 'pointer',
            background: 'rgba(196, 163, 90, 0.12)', border: '1px solid rgba(196, 163, 90, 0.3)',
            color: 'var(--accent-gold)', fontSize: '0.85rem', fontWeight: 600,
            fontFamily: 'inherit', transition: 'all 0.2s',
          }}>Start Bot</button>
        )}

        <div style={{ flex: 1 }} />

        {!confirmDelete ? (
          <button onClick={() => setConfirmDelete(true)} style={{
            padding: '10px 16px', borderRadius: '6px', cursor: 'pointer',
            background: 'transparent', border: '1px solid rgba(199, 80, 80, 0.15)',
            color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 500,
            fontFamily: 'inherit', transition: 'all 0.2s',
          }}>Delete Bot</button>
        ) : (
          <button onClick={onDelete} style={{
            padding: '10px 16px', borderRadius: '6px', cursor: 'pointer',
            background: 'rgba(199, 80, 80, 0.15)', border: '1px solid rgba(199, 80, 80, 0.4)',
            color: '#c75050', fontSize: '0.8rem', fontWeight: 600,
            fontFamily: 'inherit', animation: 'pulse 1s infinite',
          }}>Confirm Delete</button>
        )}
      </div>
    </div>
  );
}
