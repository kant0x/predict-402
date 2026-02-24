interface PriceCardProps {
  strikePrice: number | null;
  currentPrice: number;
}

export function PriceCard({ strikePrice, currentPrice }: PriceCardProps) {
  const formatPrice = (p: number) =>
    '$' + p.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="card card--no-hover" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: '16px', background: '#111' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Strike Price</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '2.5rem', fontWeight: 700, color: '#c4a35a', textShadow: '0 0 20px rgba(196, 163, 90, 0.2)' }}>
          {strikePrice ? formatPrice(strikePrice) : '—'}
        </div>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Current BTC Price</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '2.5rem', fontWeight: 700, color: '#e8e8e8' }}>
          {currentPrice > 0 ? formatPrice(currentPrice) : '—'}
        </div>
      </div>
    </div>
  );
}
