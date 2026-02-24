import { useLeaderboard, useCurrentRoundId } from '../hooks/useContract';
import { formatEther } from 'viem';

const getRankStyle = (rank: number) => {
    if (rank === 1) return { color: 'var(--accent-gold)', fontWeight: 800 };
    if (rank === 2) return { color: '#c0c0c0', fontWeight: 700 };
    if (rank === 3) return { color: '#cd7f32', fontWeight: 700 };
    return { color: 'var(--text-muted)', fontWeight: 600 };
};

const getAccuracyColor = (acc: number) => {
    if (acc >= 75) return 'var(--accent-success)';
    if (acc >= 50) return 'var(--accent-secondary)';
    return 'var(--text-secondary)';
};

// Format address 0x1234...5678
const formatAddr = (addr: string) => addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : '';

export function LeaderboardPage() {
    const { leaderboard, isLoading } = useLeaderboard();
    const { roundId } = useCurrentRoundId();

    const totalPlayers = leaderboard.length;

    // Sort leaderboard by earnings, then wins
    const sortedLeaderboard = [...leaderboard].sort((a, b) => {
        if (b.totalEarnings > a.totalEarnings) return 1;
        if (b.totalEarnings < a.totalEarnings) return -1;
        return Number(b.totalWins) - Number(a.totalWins);
    });

    const totalVolumeEth = sortedLeaderboard.reduce((acc, p) => acc + Number(formatEther(p.totalEarnings)), 0);

    return (
        <div style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem 1.5rem', animation: 'slideUp 0.5s ease forwards' }}>
            {/* Hero */}
            <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
                <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                    padding: '4px 12px', background: 'rgba(91, 138, 114, 0.08)',
                    border: '1px solid rgba(91, 138, 114, 0.15)', borderRadius: '20px',
                    fontSize: '0.7rem', fontWeight: 600, color: 'var(--accent-primary)',
                    textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '1rem',
                }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" /><path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" /><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" /><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
                    </svg>
                    Rankings
                </div>
                <h1 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text-primary)', margin: '0 0 0.5rem' }}>Realtime Leaderboard</h1>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', maxWidth: '460px', margin: '0 auto' }}>Top predictors and their on-chain trading performance.</p>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '2rem' }}>
                {[
                    { label: 'Total Players', value: isLoading ? '...' : totalPlayers.toString() },
                    { label: 'Platform Profit', value: isLoading ? '...' : `${totalVolumeEth.toFixed(2)} ETH` },
                    { label: 'Active Round', value: roundId ? `#${roundId}` : '...' },
                ].map((stat) => (
                    <div key={stat.label} style={{
                        textAlign: 'center', padding: '1rem',
                        background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-md)',
                    }}>
                        <div style={{ fontSize: '1.4rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', marginBottom: '4px' }}>{stat.value}</div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{stat.label}</div>
                    </div>
                ))}
            </div>

            {/* Table */}
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr>
                            {['Rank', 'Player', 'Wins', 'Bets', 'Win Rate', 'Total Earned'].map((h, i) => (
                                <th key={h} style={{
                                    padding: '0.75rem 1rem', textAlign: i === 5 ? 'right' : 'left',
                                    fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-muted)',
                                    textTransform: 'uppercase', letterSpacing: '0.06em',
                                    borderBottom: '1px solid var(--border-subtle)', background: 'rgba(255,255,255,0.02)',
                                }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading && leaderboard.length === 0 ? (
                            <tr><td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading on-chain data...</td></tr>
                        ) : sortedLeaderboard.length === 0 ? (
                            <tr><td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No players yet on the leaderboard.</td></tr>
                        ) : (
                            sortedLeaderboard.map((entry, index) => {
                                const rank = index + 1;
                                const winRatePercent = Number(entry.winRate) / 100; // Contract stores usually in basis points or direct % depending on your implementation. Let's assume it's like 5000 = 50.00% or 50 = 50%. Assuming 5000 = 50.00%:
                                const accuracy = Number(entry.winRate) > 100 ? Number(entry.winRate) / 100 : Number(entry.winRate);
                                const earningsEth = Number(formatEther(entry.totalEarnings));

                                return (
                                    <tr key={entry.player} style={{ transition: 'background 0.2s' }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(91, 138, 114, 0.04)'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                    >
                                        <td style={{ padding: '0.75rem 1rem', ...getRankStyle(rank), fontSize: '0.9rem' }}>#{rank}</td>
                                        <td style={{ padding: '0.75rem 1rem' }}>
                                            <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>{entry.nickname || 'Anonymous'}</div>
                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{formatAddr(entry.player)}</div>
                                        </td>
                                        <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.85rem' }}>{Number(entry.totalWins)}</td>
                                        <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>{Number(entry.totalBets)}</td>
                                        <td style={{ padding: '0.75rem 1rem' }}>
                                            <span style={{ color: getAccuracyColor(accuracy), fontWeight: 600, fontSize: '0.85rem', fontFamily: 'var(--font-mono)' }}>{accuracy.toFixed(1)}%</span>
                                        </td>
                                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-success)', fontSize: '0.85rem' }}>
                                            {earningsEth > 0 ? '+' : ''}{earningsEth.toFixed(4)} ETH
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
