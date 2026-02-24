export function Footer() {
    const linkStyle = {
        color: 'var(--text-secondary)',
        textDecoration: 'none',
        transition: 'color 0.2s',
        fontSize: '0.75rem',
    };

    return (
        <footer style={{
            padding: '1.5rem 2rem',
            textAlign: 'center' as const,
            borderTop: '1px solid rgba(255,255,255,0.04)',
            color: 'var(--text-muted)',
            fontSize: '0.75rem',
        }}>
            <p style={{ margin: 0 }}>
                <strong style={{ color: 'var(--text-secondary)' }}>Predict 402</strong>
                <span style={{ margin: '0 6px', opacity: 0.3 }}>·</span>
                Powered by{' '}
                <a href="https://opengradient.ai" target="_blank" rel="noopener noreferrer" style={linkStyle}>
                    OpenGradient
                </a>
                <span style={{ margin: '0 6px', opacity: 0.3 }}>·</span>
                Verified by AI (TEE)
            </p>
            <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                {[
                    { label: 'Explorer', href: 'https://explorer.opengradient.ai' },
                    { label: 'Faucet', href: 'https://faucet.opengradient.ai' },
                    { label: 'Discord', href: 'https://discord.gg/axammqTRDz' },
                    { label: 'Docs', href: 'https://docs.opengradient.ai/' },
                ].map((link, i) => (
                    <span key={link.label} style={{ display: 'flex', alignItems: 'center' }}>
                        {i > 0 && <span style={{ margin: '0 6px', opacity: 0.2, color: 'var(--text-muted)' }}>·</span>}
                        <a
                            href={link.href} target="_blank" rel="noopener noreferrer"
                            style={linkStyle}
                            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
                            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
                        >
                            {link.label}
                        </a>
                    </span>
                ))}
            </div>
        </footer>
    );
}
