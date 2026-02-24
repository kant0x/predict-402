import { useState, type FormEvent } from 'react';

interface AiPrediction {
    price: number;
    direction: string;
    payment_hash: string;
    model: string;
    description?: string;
}

interface BetFormProps {
    onSubmit: (predictedPrice: number, amount: string) => void;
    isConnected: boolean;
    isLoading?: boolean;
    currentPrice: number | null;
    walletAddress?: string;
}

const AI_MODELS = [
    { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
    { value: 'gpt-4o', label: 'GPT-4o' },
    { value: 'gpt-4-1', label: 'GPT-4.1' },
    { value: 'claude-sonnet', label: 'Claude Sonnet' },
    { value: 'claude-opus', label: 'Claude Opus' },
    { value: 'grok-3', label: 'Grok 3' },
];

const ORACLE_API = import.meta.env.VITE_ORACLE_API || 'http://localhost:3402';

export function BetForm({ onSubmit, isConnected, isLoading, currentPrice, walletAddress }: BetFormProps) {
    const [predictedPrice, setPredictedPrice] = useState('');
    const [betAmount, setBetAmount] = useState('');
    const [selectedModel, setSelectedModel] = useState('gemini-2.5-flash');
    const [aiPrediction, setAiPrediction] = useState<AiPrediction | null>(null);
    const [aiLoading, setAiLoading] = useState(false);
    const [aiError, setAiError] = useState<string | null>(null);

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (!predictedPrice || !betAmount) return;
        onSubmit(parseFloat(predictedPrice), betAmount);
    };

    const autofillPrice = () => { if (currentPrice) setPredictedPrice(currentPrice.toFixed(2)); };

    const askAi = async () => {
        if (!walletAddress) return;
        setAiLoading(true); setAiError(null); setAiPrediction(null);
        try {
            const res = await fetch(`${ORACLE_API}/api/predict`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ player: walletAddress, model: selectedModel }),
            });
            if (!res.ok) { const err = await res.json(); throw new Error(err.error || `HTTP ${res.status}`); }
            const data = await res.json();
            setAiPrediction(data);
            setPredictedPrice(data.price.toFixed(2));
        } catch (err) { setAiError(err instanceof Error ? err.message : 'Is the backend running?'); }
        finally { setAiLoading(false); }
    };

    const TargetIcon = () => (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7 }}>
            <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
        </svg>
    );

    const OracleIcon = () => (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a10 10 0 1 0 10 10" /><path d="M12 12l8-8" /><path d="M16 4h4v4" />
        </svg>
    );

    const ArrowUpIcon = () => (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17l5-5 5 5" /><path d="M7 11l5-5 5 5" /></svg>
    );

    const ArrowDownIcon = () => (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M7 7l5 5 5-5" /><path d="M7 13l5 5 5-5" /></svg>
    );

    return (
        <form onSubmit={handleSubmit} style={{
            padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem',
            height: '100%', overflow: 'hidden',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
        }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '0.6rem', borderBottom: '1px solid var(--border-subtle)' }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
                    <TargetIcon /> Place Your Prediction
                </h3>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>On-chain</span>
            </div>

            {/* AI Controls */}
            <div style={{ display: 'flex', gap: '8px' }}>
                <select value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)} disabled={aiLoading || !isConnected}
                    style={{
                        flex: 1, padding: '9px 12px', borderRadius: '8px',
                        border: '1px solid var(--border-subtle)',
                        background: 'var(--bg-glass)', color: 'var(--text-secondary)',
                        fontSize: '0.85rem', outline: 'none', cursor: 'pointer', fontFamily: 'inherit', transition: 'border-color 0.2s',
                    }}
                    onFocus={(e) => e.currentTarget.style.borderColor = 'rgba(91, 138, 114, 0.3)'}
                    onBlur={(e) => e.currentTarget.style.borderColor = 'var(--border-subtle)'}
                >
                    {AI_MODELS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
                <button type="button" onClick={askAi} disabled={!isConnected || aiLoading}
                    style={{
                        padding: '9px 16px', borderRadius: '8px',
                        border: '1px solid rgba(91, 138, 114, 0.25)',
                        background: 'rgba(91, 138, 114, 0.08)',
                        color: 'var(--accent-primary)', fontSize: '0.85rem', fontWeight: 600,
                        cursor: aiLoading ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                        whiteSpace: 'nowrap', transition: 'all 0.2s', fontFamily: 'inherit',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(91, 138, 114, 0.15)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(91, 138, 114, 0.08)'; }}
                >
                    <OracleIcon />{aiLoading ? 'Thinking...' : 'Ask Oracle'}
                </button>
            </div>

            {/* AI Response Terminal */}
            <div style={{
                flex: 1, minHeight: '80px', background: 'rgba(0,0,0,0.2)',
                borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)',
                display: 'flex', flexDirection: 'column', overflow: 'hidden',
            }}>
                <div style={{
                    padding: '7px 12px', borderBottom: '1px solid var(--border-subtle)',
                    fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em',
                    display: 'flex', alignItems: 'center', gap: '6px',
                }}>
                    <div style={{
                        width: '5px', height: '5px', borderRadius: '50%',
                        background: aiLoading ? 'var(--accent-primary)' : aiPrediction ? 'var(--accent-success)' : 'var(--text-muted)',
                        boxShadow: aiLoading ? '0 0 6px var(--accent-primary-glow)' : 'none',
                    }} />
                    AI Analysis Terminal
                </div>
                <div style={{ padding: '12px', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflowY: 'auto' }} className="custom-scrollbar">
                    {aiLoading ? (
                        <div style={{ textAlign: 'center', color: 'var(--accent-primary)' }}>
                            <div style={{ width: '20px', height: '20px', margin: '0 auto 10px', border: '2px solid var(--accent-primary)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Connecting to TEE Node...</div>
                        </div>
                    ) : aiPrediction ? (
                        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{
                                    fontSize: '1.1rem', fontWeight: 700,
                                    color: aiPrediction.direction === 'UP' ? 'var(--accent-success)' : 'var(--accent-danger)',
                                    display: 'flex', alignItems: 'center', gap: '4px',
                                }}>
                                    {aiPrediction.direction === 'UP' ? <ArrowUpIcon /> : <ArrowDownIcon />}
                                    {aiPrediction.direction === 'UP' ? 'Bullish' : 'Bearish'}
                                </span>
                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>${aiPrediction.price.toLocaleString()}</span>
                            </div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5, background: 'rgba(255,255,255,0.02)', padding: '8px 10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.03)' }}>
                                {aiPrediction.description || "Based on recent market volatility..."}
                            </div>
                            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textAlign: 'right' }}>Model: {aiPrediction.model}</div>
                        </div>
                    ) : aiError ? (
                        <div style={{ color: 'var(--accent-danger)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 8v4" /><path d="M12 16h.01" /></svg>
                            {aiError}
                        </div>
                    ) : (
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center', fontStyle: 'italic', opacity: 0.5 }}>
                            Select a model and ask for a prediction.<br />Analysis will appear here.
                        </div>
                    )}
                </div>
            </div>

            {/* Bottom: Inputs & Submit */}
            <div style={{
                marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem',
                background: 'rgba(0,0,0,0.15)', padding: '12px', borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
            }}>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    {/* Price */}
                    <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Target Price</label>
                        <div style={{ position: 'relative' }}>
                            <input type="number" step="0.01" placeholder="0.00" value={predictedPrice} onChange={(e) => setPredictedPrice(e.target.value)} disabled={!isConnected || isLoading}
                                style={{
                                    width: '100%', padding: '9px 10px', borderRadius: '8px',
                                    border: '1px solid var(--border-subtle)', background: 'rgba(255,255,255,0.03)',
                                    color: 'var(--text-primary)', fontSize: '0.95rem', fontWeight: 600, fontFamily: 'var(--font-mono)',
                                    outline: 'none', transition: 'border-color 0.2s',
                                }}
                                onFocus={(e) => e.currentTarget.style.borderColor = 'rgba(91, 138, 114, 0.35)'}
                                onBlur={(e) => e.currentTarget.style.borderColor = 'var(--border-subtle)'}
                            />
                            {currentPrice && (
                                <div onClick={autofillPrice} style={{
                                    position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
                                    fontSize: '0.6rem', color: 'var(--accent-secondary)', cursor: 'pointer',
                                    fontWeight: 700, letterSpacing: '0.05em', padding: '2px 6px', borderRadius: '4px',
                                    background: 'rgba(91, 138, 114, 0.08)', transition: 'background 0.2s',
                                }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(91, 138, 114, 0.15)'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(91, 138, 114, 0.08)'}
                                >USE</div>
                            )}
                        </div>
                    </div>
                    {/* Amount */}
                    <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Amount</label>
                        <div style={{ position: 'relative' }}>
                            <input type="number" step="0.001" placeholder="0.01" value={betAmount} onChange={(e) => setBetAmount(e.target.value)} disabled={!isConnected || isLoading}
                                style={{
                                    width: '100%', padding: '9px 10px', borderRadius: '8px',
                                    border: '1px solid var(--border-subtle)', background: 'rgba(255,255,255,0.03)',
                                    color: 'var(--text-primary)', fontSize: '0.95rem', fontWeight: 600, fontFamily: 'var(--font-mono)',
                                    outline: 'none', transition: 'border-color 0.2s',
                                }}
                                onFocus={(e) => e.currentTarget.style.borderColor = 'rgba(91, 138, 114, 0.35)'}
                                onBlur={(e) => e.currentTarget.style.borderColor = 'var(--border-subtle)'}
                            />
                            <span style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 600 }}>ETH</span>
                        </div>
                    </div>
                </div>

                <button type="submit" disabled={!isConnected || isLoading || !predictedPrice || !betAmount}
                    style={{
                        width: '100%', padding: '11px', borderRadius: '8px',
                        border: '1px solid rgba(196, 163, 90, 0.25)',
                        background: (!isConnected || isLoading) ? 'rgba(255,255,255,0.03)' : 'rgba(196, 163, 90, 0.08)',
                        color: (!isConnected || isLoading) ? 'var(--text-muted)' : 'var(--accent-gold)',
                        fontWeight: 700, fontSize: '0.85rem',
                        cursor: (!isConnected || isLoading) ? 'not-allowed' : 'pointer',
                        textTransform: 'uppercase', letterSpacing: '0.06em',
                        transition: 'all 0.2s', fontFamily: 'inherit',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                    }}
                    onMouseEnter={(e) => { if (isConnected && !isLoading) { e.currentTarget.style.background = 'rgba(196, 163, 90, 0.15)'; } }}
                    onMouseLeave={(e) => { if (isConnected && !isLoading) { e.currentTarget.style.background = 'rgba(196, 163, 90, 0.08)'; } }}
                >
                    {isLoading ? (
                        <>
                            <div style={{ width: '14px', height: '14px', border: '2px solid var(--accent-gold)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                            Processing...
                        </>
                    ) : !isConnected ? 'Connect Wallet' : (
                        <><TargetIcon /> Place Prediction</>
                    )}
                </button>
            </div>
        </form>
    );
}
