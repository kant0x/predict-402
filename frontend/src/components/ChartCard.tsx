import { BtcChart } from './BtcChart';

interface ChartCardProps {
  strikePrice: number | null;
}

export function ChartCard({ strikePrice }: ChartCardProps) {
  return (
    <div className="card card--no-hover" style={{ padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0, height: '100%' }}>
      <div className="chart-header">
        <span className="chart-header__pair">BTC / USDT</span>
        <span className="chart-header__live">
          <span className="chart-header__live-dot" />
          Live
        </span>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <BtcChart strikePrice={strikePrice} />
      </div>
    </div>
  );
}
