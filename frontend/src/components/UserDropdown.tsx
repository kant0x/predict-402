import { useState, useRef, useEffect } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { motion, AnimatePresence } from 'framer-motion';
import { parseAbiItem, formatEther } from 'viem';
import { PREDICT402_ADDRESS } from '../config/contracts';

export function UserDropdown() {
    const { address } = useAccount();
    const publicClient = usePublicClient();
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [fetchError, setFetchError] = useState<string | null>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) setIsOpen(false);
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        async function fetchHistory() {
            if (isOpen && address && publicClient) {
                setLoading(true);
                setFetchError(null);
                try {
                    const currentBlock = await publicClient.getBlockNumber();
                    const BLOCKS_TO_FETCH = 99990n; // ~100,000 blocks back
                    const CHUNK_SIZE = 9990n;
                    const earliestBlock = currentBlock > BLOCKS_TO_FETCH ? currentBlock - BLOCKS_TO_FETCH : 0n;

                    let betLogs: any[] = [];
                    let payoutLogs: any[] = [];

                    // Fetch in chunks to avoid OpenGradient's "maximum [from, to] blocks distance: 10000" error
                    for (let i = earliestBlock; i <= currentBlock; i += CHUNK_SIZE + 1n) {
                        const endBlock = (i + CHUNK_SIZE) > currentBlock ? currentBlock : (i + CHUNK_SIZE);
                        const [bLogs, pLogs] = await Promise.all([
                            publicClient.getLogs({
                                address: PREDICT402_ADDRESS,
                                event: parseAbiItem('event BetPlaced(address indexed player, uint256 indexed roundId, bool isUp, uint256 amount, string nickname, bool usedAi)'),
                                args: { player: address },
                                fromBlock: i,
                                toBlock: endBlock
                            }).catch(() => [] as any[]),
                            publicClient.getLogs({
                                address: PREDICT402_ADDRESS,
                                event: parseAbiItem('event Payout(address indexed player, uint256 amount)'),
                                args: { player: address },
                                fromBlock: i,
                                toBlock: endBlock
                            }).catch(() => [] as any[])
                        ]);
                        betLogs = [...betLogs, ...bLogs];
                        payoutLogs = [...payoutLogs, ...pLogs];
                    }

                    // We will just map BetPlaced as "Placed" and Payout as "Claimed" for visibility.
                    // Strictly speaking, we don't know which interaction won from Payout log alone 
                    // without looking at the transaction hash or block, 
                    // but we can map them together or just show both.

                    // Fetch timestamps for all unique blocks
                    const blockNumbers = new Set(
                        [...betLogs, ...payoutLogs].map(l => l.blockNumber).filter(b => b !== null)
                    );
                    const blockTimes = new Map<bigint, number>();

                    // To avoid firing too many RPC calls, we'll fetch them in parallel chunks or just Promise.all
                    // This is simple enough for small history
                    await Promise.all(
                        Array.from(blockNumbers).map(async blockNum => {
                            if (blockNum) {
                                try {
                                    const block = await publicClient.getBlock({ blockNumber: blockNum });
                                    blockTimes.set(blockNum, Number(block.timestamp) * 1000);
                                } catch (e) {
                                    console.error("Failed fetching block", blockNum, e);
                                }
                            }
                        })
                    );

                    const formattedBets = betLogs.map(log => {
                        const { roundId, isUp, amount } = log.args as any;
                        const ts = log.blockNumber && blockTimes.has(log.blockNumber)
                            ? blockTimes.get(log.blockNumber)!
                            : Date.now();
                        return {
                            roundId: roundId.toString(),
                            direction: isUp ? 'UP' : 'DOWN',
                            amount: formatEther(amount),
                            timestamp: ts,
                            outcome: 'Placed'
                        };
                    });

                    const formattedPayouts = payoutLogs.map(log => {
                        const { amount } = log.args as any;
                        const ts = log.blockNumber && blockTimes.has(log.blockNumber)
                            ? blockTimes.get(log.blockNumber)!
                            : Date.now();
                        return {
                            roundId: '—', // Payout event doesn't emit roundId
                            direction: 'WIN',
                            amount: formatEther(amount),
                            timestamp: ts,
                            outcome: 'Claimed'
                        };
                    });

                    const combined = [...formattedBets, ...formattedPayouts].sort((a, b) => b.timestamp - a.timestamp);

                    setHistory(combined);
                } catch (e: any) {
                    console.error("Failed to fetch history:", e);
                    setFetchError(e.message || "RPC Error");
                } finally { setLoading(false); }
            }
        }
        fetchHistory();
    }, [isOpen, address, publicClient]);

    if (!address) return null;

    return (
        <div ref={wrapperRef} style={{ position: 'relative', zIndex: 50 }}>
            <button onClick={() => setIsOpen(!isOpen)} style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '0 14px', height: '38px', fontSize: '0.85rem',
                fontWeight: 600, fontFamily: 'inherit',
                color: '#e8e8e8',
                background: isOpen ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px',
                cursor: 'pointer', transition: 'all 0.2s',
            }}
                onMouseEnter={(e) => { if (!isOpen) e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
                onMouseLeave={(e) => { if (!isOpen) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7 }}>
                    <path d="M3 3v18h18" /><path d="m19 9-5 5-4-4-3 3" />
                </svg>
                <span>History</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                    style={{ transition: 'transform 0.25s ease', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', opacity: 0.5 }}
                ><path d="m6 9 6 6 6-6" /></svg>
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.97 }}
                        transition={{ duration: 0.18, ease: 'easeOut' }}
                        style={{
                            position: 'absolute', right: 0, marginTop: '10px', width: '340px',
                            borderRadius: 'var(--radius-lg)',
                            border: '1px solid rgba(196, 163, 90, 0.15)',
                            background: 'rgba(10, 10, 10, 0.97)',
                            backdropFilter: 'blur(24px)',
                            boxShadow: '0 12px 48px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.03) inset',
                            overflow: 'hidden', zIndex: 100, transformOrigin: 'top right',
                        }}
                    >
                        {/* Panel Header */}
                        <div style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.05)',
                            background: 'linear-gradient(to right, rgba(91, 138, 114, 0.04), transparent)',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent-primary)', boxShadow: '0 0 8px var(--accent-primary-glow)' }} />
                                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>Betting History</span>
                            </div>
                            <span style={{
                                fontSize: '0.7rem', fontWeight: 500,
                                color: loading ? 'var(--accent-primary)' : 'var(--text-muted)',
                                letterSpacing: '0.04em', textTransform: 'uppercase',
                            }}>{loading ? '● Syncing' : 'On-chain'}</span>
                        </div>

                        {/* Content */}
                        <div style={{ maxHeight: '360px', overflowY: 'auto', padding: '10px' }} className="custom-scrollbar">
                            {loading && history.length === 0 ? (
                                <div style={{ padding: '2.5rem 1rem', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                    <div style={{ width: '24px', height: '24px', margin: '0 auto 12px', border: '2px solid var(--accent-primary)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                                    Syncing history…
                                </div>
                            ) : fetchError ? (
                                <div style={{ padding: '2.5rem 1rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                    <div style={{ width: '44px', height: '44px', borderRadius: 'var(--radius-md)', background: 'rgba(199, 80, 80, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px', border: '1px solid rgba(199, 80, 80, 0.2)' }}>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-danger)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                                    </div>
                                    <p style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--accent-danger)', marginBottom: '4px' }}>Sync Failed</p>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{fetchError}</p>
                                </div>
                            ) : history.length === 0 ? (
                                <div style={{ padding: '2.5rem 1rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: 0.6 }}>
                                    <div style={{ width: '44px', height: '44px', borderRadius: 'var(--radius-md)', background: 'var(--bg-glass)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px', border: '1px solid var(--border-subtle)' }}>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18" /><path d="m19 9-5 5-4-4-3 3" /></svg>
                                    </div>
                                    <p style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>No bets yet</p>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Place your first prediction to get started</p>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    {history.map((item, i) => (
                                        <div key={i} style={{
                                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                            padding: '12px 14px', borderRadius: 'var(--radius-md)',
                                            background: 'var(--bg-glass)', border: '1px solid var(--border-subtle)',
                                            transition: 'all 0.2s ease', cursor: 'default',
                                        }}
                                            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(91, 138, 114, 0.08)'; e.currentTarget.style.borderColor = 'rgba(91, 138, 114, 0.2)'; }}
                                            onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--bg-glass)'; e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}
                                        >
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>Round #{item.roundId}</span>
                                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                </div>
                                                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{item.amount} ETH</span>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px' }}>
                                                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: item.direction === 'WIN' ? 'var(--accent-gold)' : item.direction === 'UP' ? 'var(--accent-success)' : 'var(--accent-danger)', fontFamily: 'var(--font-mono)' }}>{item.direction === 'WIN' ? '★ ' : item.direction === 'UP' ? '↑ ' : '↓ '}{item.direction}</span>
                                                <span style={{ fontSize: '0.65rem', fontWeight: 600, color: item.outcome === 'Claimed' ? 'var(--accent-success)' : 'var(--accent-primary)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{item.outcome}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
