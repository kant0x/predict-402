import { useState, type FormEvent } from 'react';

interface NicknameModalProps {
    onSubmit: (nickname: string) => void;
    onClose?: () => void;
    isLoading?: boolean;
    isWrongNetwork?: boolean;
}

export function NicknameModal({ onSubmit, onClose, isLoading, isWrongNetwork }: NicknameModalProps) {
    const [nickname, setNickname] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        const trimmed = nickname.trim();
        if (trimmed.length < 3) { setError('Nickname must be at least 3 characters'); return; }
        if (trimmed.length > 16) { setError('Nickname must be 16 characters max'); return; }
        if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) { setError('Only letters, numbers, _ and - allowed'); return; }
        setError('');
        onSubmit(trimmed);
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 2000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(10px)',
        }}>
            <div style={{
                background: 'rgba(10, 10, 10, 0.97)',
                padding: '2rem',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid rgba(196, 163, 90, 0.15)',
                maxWidth: '400px',
                width: '100%',
                boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
                backdropFilter: 'blur(20px)',
                textAlign: 'center',
                position: 'relative',
            }}>
                {/* Close Button */}
                {onClose && (
                    <button
                        onClick={onClose}
                        style={{
                            position: 'absolute',
                            top: '1rem',
                            right: '1rem',
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            padding: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '50%',
                            transition: 'color 0.2s',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
                        onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                        aria-label="Close"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                )}
                {/* Icon */}
                <div style={{
                    width: '48px', height: '48px', borderRadius: '12px',
                    background: 'rgba(91, 138, 114, 0.08)',
                    border: '1px solid rgba(91, 138, 114, 0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 1rem', color: 'var(--accent-primary)',
                }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                    </svg>
                </div>

                <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 0.5rem' }}>
                    Choose Your Nickname
                </h2>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.5rem', lineHeight: 1.5 }}>
                    Welcome to <strong style={{ color: 'var(--text-secondary)' }}>Predict 402</strong>. Pick a unique nickname for the leaderboard. Stored on-chain.
                </p>

                {isWrongNetwork ? (
                    <div style={{ padding: '1rem 0' }}>
                        <div style={{
                            fontSize: '0.9rem', color: 'var(--accent-danger)', fontWeight: 600,
                            background: 'rgba(199, 80, 80, 0.1)', border: '1px solid rgba(199, 80, 80, 0.2)',
                            borderRadius: '8px', padding: '12px', marginBottom: '1rem'
                        }}>
                            Вы подключены к неправильной сети.
                        </div>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                            Пожалуйста, переключите сеть в вашем кошельке на <strong>OpenGradient Testnet</strong> для регистрации ника и участия в раундах.
                        </p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit}>
                        <input
                            type="text" placeholder="e.g. CryptoOracle42" value={nickname}
                            onChange={(e) => { setNickname(e.target.value); setError(''); }}
                            maxLength={16} autoFocus id="nickname-input"
                            style={{
                                width: '100%', padding: '12px 14px', borderRadius: '8px',
                                border: '1px solid rgba(255,255,255,0.06)',
                                background: 'rgba(255,255,255,0.03)', color: 'var(--text-primary)',
                                fontSize: '1rem', outline: 'none', boxSizing: 'border-box',
                                marginBottom: error ? '0.5rem' : '1rem',
                                transition: 'border-color 0.2s', fontFamily: 'inherit',
                            }}
                            onFocus={(e) => e.currentTarget.style.borderColor = 'rgba(91, 138, 114, 0.35)'}
                            onBlur={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'}
                        />
                        {error && (
                            <p style={{ fontSize: '0.8rem', color: 'var(--accent-danger)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10" /><path d="M12 8v4" /><path d="M12 16h.01" />
                                </svg>
                                {error}
                            </p>
                        )}
                        <button
                            type="submit" disabled={isLoading} id="submit-nickname-btn"
                            style={{
                                width: '100%', padding: '12px', borderRadius: '8px',
                                border: '1px solid rgba(91, 138, 114, 0.25)',
                                background: isLoading ? 'rgba(255,255,255,0.03)' : 'rgba(91, 138, 114, 0.1)',
                                color: isLoading ? 'var(--text-muted)' : 'var(--accent-primary)',
                                fontWeight: 700, fontSize: '0.9rem',
                                cursor: isLoading ? 'not-allowed' : 'pointer',
                                transition: 'all 0.2s', fontFamily: 'inherit',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                            }}
                            onMouseEnter={(e) => { if (!isLoading) { e.currentTarget.style.background = 'rgba(91, 138, 114, 0.18)'; e.currentTarget.style.borderColor = 'rgba(91, 138, 114, 0.4)'; } }}
                            onMouseLeave={(e) => { if (!isLoading) { e.currentTarget.style.background = 'rgba(91, 138, 114, 0.1)'; e.currentTarget.style.borderColor = 'rgba(91, 138, 114, 0.25)'; } }}
                        >
                            {isLoading ? (
                                <>
                                    <div style={{ width: '14px', height: '14px', border: '2px solid var(--accent-primary)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                                    Registering...
                                </>
                            ) : (
                                <>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
                                    </svg>
                                    Enter the Vault
                                </>
                            )}
                        </button>
                    </form>
                )}

                <p style={{ marginTop: '1rem', fontSize: '0.65rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                    OpenGradient Testnet · Chain ID 10740
                </p>
            </div>
        </div>
    );
}
