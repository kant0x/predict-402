import { useState } from 'react';

export interface BotConfig {
  id: string;
  name: string;
  strategy: 'llm' | 'ml';
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  maxBetEth: number;
  minConfidence: number;
  betScaling: { high: number; mid: number; low: number };
  createdAt: number;
}

export interface BotStatus {
  running: boolean;
  wins: number;
  losses: number;
  logs: { time: string; round: number; direction: string; confidence: number; amount: number; result?: string }[];
}

const MODEL_LABELS: Record<string, string> = {
  'gemini-2.5-flash': 'Gemini 2.5 Flash',
  'gemini-2.5-pro': 'Gemini 2.5 Pro',
  'gpt-4o': 'GPT-4o',
  'gpt-4-1': 'GPT-4.1',
  'o4-mini': 'O4 Mini',
  'claude-sonnet': 'Claude 4.0 Sonnet',
  'claude-haiku': 'Claude 3.5 Haiku',
  'grok-3': 'Grok 3 Beta',
  'grok-4-1': 'Grok 4.1 Fast',
  'btc_xgboost': 'BTC XGBoost',
};

interface BotCardProps {
  bot: BotConfig;
  status: BotStatus;
  balance: { eth: number; ousdc: number };
  onConfigure: () => void;
  onStart: () => void;
  onStop: () => void;
  isSelected: boolean;
}

export function BotCard({ bot, status, balance, onConfigure, onStart, onStop, isSelected }: BotCardProps) {
  const [hoverBtn, setHoverBtn] = useState<string | null>(null);

  const total = status.wins + status.losses;
  const winRate = total > 0 ? ((status.wins / total) * 100).toFixed(1) : '—';
  const statusColor = status.running ? 'var(--accent-success)' : '#c75050';
  const statusLabel = status.running ? 'Active' : 'Stopped';

  return (
    <div style={{
      background: isSelected ? 'rgba(196, 163, 90, 0.06)' : 'var(--bg-card)',
      border: isSelected ? '1px solid rgba(196, 163, 90, 0.25)' : '1px solid rgba(255,255,255,0.06)',
      borderRadius: '12px',
      padding: '20px',
      minWidth: '240px',
      maxWidth: '320px',
      flex: '1 1 280px',
      transition: 'all 0.2s',
    }}>
      {/* Status + Name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <div style={{
          width: '8px', height: '8px', borderRadius: '50%',
          background: statusColor,
          boxShadow: status.running ? `0 0 8px ${statusColor}` : 'none',
          animation: status.running ? 'pulse 2s infinite' : 'none',
        }} />
        <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '1rem' }}>{bot.name}</span>
      </div>

      {/* Model */}
      <div style={{
        fontSize: '0.75rem', color: 'var(--text-secondary)',
        marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px',
      }}>
        <span style={{
          padding: '2px 6px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 600,
          background: bot.strategy === 'llm' ? 'rgba(91, 138, 114, 0.15)' : 'rgba(196, 163, 90, 0.15)',
          color: bot.strategy === 'llm' ? 'var(--accent-success)' : 'var(--accent-gold)',
          textTransform: 'uppercase', letterSpacing: '0.05em',
        }}>{bot.strategy}</span>
        {MODEL_LABELS[bot.model] || bot.model}
      </div>

      {/* Stats */}
      <div style={{
        display: 'flex', gap: '16px', marginBottom: '12px',
        fontSize: '0.8rem', color: 'var(--text-secondary)',
      }}>
        <span>
          W:<span style={{ color: 'var(--accent-success)', fontWeight: 600 }}>{status.wins}</span>
          {' '}L:<span style={{ color: '#c75050', fontWeight: 600 }}>{status.losses}</span>
        </span>
        <span style={{ color: 'var(--text-muted)' }}>|</span>
        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{winRate}%</span>
      </div>

      {/* Balance */}
      <div style={{
        fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '16px',
        fontFamily: 'var(--font-mono)',
      }}>
        Balance: <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{balance.eth.toFixed(4)} ETH</span>
      </div>

      {/* Status label */}
      <div style={{
        fontSize: '0.7rem', color: statusColor, fontWeight: 500,
        marginBottom: '12px', letterSpacing: '0.03em',
      }}>
        {statusLabel}
      </div>

      {/* Buttons */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={onConfigure}
          onMouseEnter={() => setHoverBtn('cfg')}
          onMouseLeave={() => setHoverBtn(null)}
          style={{
            flex: 1, padding: '8px 12px', borderRadius: '6px', cursor: 'pointer',
            background: hoverBtn === 'cfg' ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: 'var(--text-primary)', fontSize: '0.8rem', fontWeight: 500,
            fontFamily: 'inherit', transition: 'all 0.2s',
          }}
        >Configure</button>

        {status.running ? (
          <button
            onClick={onStop}
            onMouseEnter={() => setHoverBtn('stop')}
            onMouseLeave={() => setHoverBtn(null)}
            style={{
              flex: 1, padding: '8px 12px', borderRadius: '6px', cursor: 'pointer',
              background: hoverBtn === 'stop' ? 'rgba(199, 80, 80, 0.15)' : 'rgba(199, 80, 80, 0.08)',
              border: '1px solid rgba(199, 80, 80, 0.3)',
              color: '#c75050', fontSize: '0.8rem', fontWeight: 500,
              fontFamily: 'inherit', transition: 'all 0.2s',
            }}
          >Stop</button>
        ) : (
          <button
            onClick={onStart}
            onMouseEnter={() => setHoverBtn('start')}
            onMouseLeave={() => setHoverBtn(null)}
            style={{
              flex: 1, padding: '8px 12px', borderRadius: '6px', cursor: 'pointer',
              background: hoverBtn === 'start' ? 'rgba(91, 138, 114, 0.15)' : 'rgba(91, 138, 114, 0.08)',
              border: '1px solid rgba(91, 138, 114, 0.3)',
              color: 'var(--accent-success)', fontSize: '0.8rem', fontWeight: 500,
              fontFamily: 'inherit', transition: 'all 0.2s',
            }}
          >Start</button>
        )}
      </div>
    </div>
  );
}
