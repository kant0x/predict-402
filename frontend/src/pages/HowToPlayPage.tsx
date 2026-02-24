const steps = [
    {
        number: 1, title: 'Connect Your Wallet',
        description: 'Use MetaMask or any EVM wallet. Choose a unique nickname that will appear on the leaderboard.',
        icon: (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="12" rx="2" /><path d="M22 10H2" /><path d="M6 14h2" /><path d="M14 14h4" /></svg>),
    },
    {
        number: 2, title: 'Get Testnet ETH',
        description: (<>Grab free testnet tokens from the{' '}<a href="https://faucet.opengradient.ai" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary)', textDecoration: 'none', fontWeight: 600 }}>OpenGradient Faucet</a>. No real money involved.</>),
        icon: (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" /></svg>),
    },
    {
        number: 3, title: 'Deposit into the Vault',
        description: 'Deposit ETH into the Vault 402 smart contract. This funds your betting balance. You can withdraw at any time.',
        icon: (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" /><path d="M3 5v14a2 2 0 0 0 2 2h16v-5" /><path d="M18 12a2 2 0 0 0 0 4h4v-4Z" /></svg>),
    },
    {
        number: 4, title: 'Predict BTC Price',
        description: 'Each round, predict where BTC will close. Use your own analysis or ask an AI Oracle.',
        icon: (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg>),
    },
    {
        number: 5, title: 'Win Rewards',
        description: 'The closest prediction wins the round\'s pool. Accuracy is calculated as a percentage.',
        icon: (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>),
    },
];

const payoutStructure = [
    { tier: '1st Place', share: '60%', color: 'var(--accent-gold)' },
    { tier: '2nd Place', share: '25%', color: '#c0c0c0' },
    { tier: '3rd Place', share: '10%', color: '#cd7f32' },
    { tier: 'Protocol', share: '5%', color: 'var(--text-muted)' },
];

export function HowToPlayPage() {
    return (
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem 1.5rem', animation: 'slideUp 0.5s ease forwards' }}>
            {/* Hero */}
            <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
                <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                    padding: '4px 12px', background: 'rgba(91, 138, 114, 0.08)',
                    border: '1px solid rgba(91, 138, 114, 0.15)', borderRadius: '20px',
                    fontSize: '0.7rem', fontWeight: 600, color: 'var(--accent-primary)',
                    textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '1rem',
                }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><path d="M12 17h.01" /></svg>
                    Guide
                </div>
                <h1 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text-primary)', margin: '0 0 0.5rem' }}>How to Play</h1>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', maxWidth: '460px', margin: '0 auto' }}>Predict the closing price of BTC. Closest guess wins the pool.</p>
            </div>

            {/* Steps */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '2.5rem' }}>
                {steps.map((step, i) => (
                    <div key={step.number} style={{
                        display: 'flex', gap: '1rem', padding: '1rem 1.25rem',
                        background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-md)', transition: 'border-color 0.2s',
                        animation: `slideUp 0.5s ease ${i * 0.08}s forwards`, opacity: 0,
                    }}
                        onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(91, 138, 114, 0.15)'}
                        onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border-subtle)'}
                    >
                        <div style={{
                            width: '36px', height: '36px', borderRadius: '10px',
                            background: 'rgba(91, 138, 114, 0.08)', border: '1px solid rgba(91, 138, 114, 0.15)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'var(--accent-primary)',
                        }}>{step.icon}</div>
                        <div>
                            <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 4px' }}>{step.title}</h3>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>{step.description}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Payout Structure */}
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', marginBottom: '2.5rem' }}>
                <div style={{
                    padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--border-subtle)',
                    fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)',
                    textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: '6px',
                }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
                    Payout Structure
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <tbody>
                        {payoutStructure.map((p) => (
                            <tr key={p.tier} style={{ transition: 'background 0.2s' }}
                                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                            >
                                <td style={{ padding: '0.75rem 1.25rem', color: p.color, fontWeight: 700, fontSize: '0.85rem', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>{p.tier}</td>
                                <td style={{ padding: '0.75rem 1.25rem', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>{p.share}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Tech Stack */}
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: '1.25rem' }}>
                <div style={{
                    fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)',
                    textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '1rem',
                    display: 'flex', alignItems: 'center', gap: '6px',
                }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg>
                    Technology Stack
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {['Solidity', 'OpenGradient TEE', 'AI Oracles', 'React + Vite', 'wagmi / viem'].map((tech) => (
                        <span key={tech} style={{
                            padding: '5px 12px', background: 'rgba(255,255,255,0.03)',
                            border: '1px solid var(--border-subtle)', borderRadius: '6px',
                            fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500,
                        }}>{tech}</span>
                    ))}
                </div>
            </div>
        </div>
    );
}
