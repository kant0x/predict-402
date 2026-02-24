export interface Trade {
  id: number;
  direction: 'up' | 'down';
  amount: number;
  status: 'Pending' | 'Won' | 'Lost';
}

interface TradeHistoryProps {
  trades: Trade[];
}

export function TradeHistory({ trades }: TradeHistoryProps) {
  return (
    <div className="card card--no-hover" style={{
      background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '16px',
      padding: '16px', display: 'flex', flexDirection: 'column'
    }}>
      <div style={{ fontSize: '0.65rem', fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '16px' }}>
        TRADE HISTORY
      </div>

      {trades.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, padding: '32px 0' }}>
          <div style={{ color: '#555', fontSize: '0.8rem', textAlign: 'center', lineHeight: 1.5 }}>
            No trades yet.<br />
            Place a bet to see history.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {trades.map(t => (
            <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', fontWeight: 600, color: '#e8e8e8' }}>#{t.id}</div>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: t.direction === 'up' ? '#5b8a72' : '#c75050' }}>
                  {t.direction === 'up' ? '↑ UP' : '↓ DOWN'}
                </div>
              </div>
              <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 500, color: '#888' }}>{t.status}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: '#888' }}>{t.amount.toFixed(4)} ETH</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
