import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useDisconnect } from 'wagmi';
import { useDeposit } from '../context/DepositContext';
import { DepositModal } from './DepositModal';
import { UserDropdown } from './UserDropdown';

export function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isConnected, connector, chain: wagmiChain } = useAccount();
  const { disconnect } = useDisconnect();
  const { depositAddress } = useDeposit();
  const [isDepositOpen, setDepositOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [walletDropdownOpen, setWalletDropdownOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const walletDropdownRef = useRef<HTMLDivElement>(null);

  // Close wallet dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (walletDropdownRef.current && !walletDropdownRef.current.contains(event.target as Node)) {
        setWalletDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const navItems = [
    { label: 'Game', path: '/' },
    { label: 'Leaderboard', path: '/leaderboard' },
    { label: 'How to Play', path: '/how-to-play' },
    { label: 'Bots', path: '/bots' },
  ];

  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 100,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 2rem', height: '64px',
      background: 'rgba(10, 10, 10, 0.88)',
      backdropFilter: 'blur(20px) saturate(180%)',
      borderBottom: '1px solid rgba(196, 163, 90, 0.08)',
    }}>
      {/* Left: Hamburger + Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {/* Hamburger */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer', color: '#888',
              padding: '4px', display: 'flex', alignItems: 'center',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          {menuOpen && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, marginTop: '8px',
              background: 'rgba(20, 20, 20, 0.98)', border: '1px solid rgba(196, 163, 90, 0.12)',
              borderRadius: '12px', padding: '8px', minWidth: '200px', zIndex: 200,
              boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
            }}>
              {[
                { label: 'Manual Trading', path: '/' },
                { label: 'BitQuant Trading', path: '/bitquant' },
                { label: 'Prediction Bots', path: '/bots' },
              ].map(item => (
                <div key={item.label} style={{
                  padding: '10px 16px', borderRadius: '8px', cursor: 'pointer',
                  color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 500,
                  transition: 'all 0.2s',
                }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(91, 138, 114, 0.08)'; e.currentTarget.style.color = '#fff'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                  onClick={() => { navigate(item.path); setMenuOpen(false); }}
                >{item.label}</div>
              ))}
            </div>
          )}
        </div>

        {/* Logo */}
        <div
          onClick={() => navigate('/')}
          style={{
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
            fontWeight: 700, fontSize: '1.2rem', letterSpacing: '-0.03em', transition: 'opacity 0.2s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
          onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
        >
          <span style={{ color: '#e8e8e8' }}>Predict <span style={{ color: '#888', fontWeight: 500 }}>402</span></span>
          <span style={{ fontSize: '0.65rem', border: '1px solid rgba(196, 163, 90, 0.3)', color: '#c4a35a', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>ALPHA</span>
        </div>
      </div>

      {/* Center Navigation */}
      <nav style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <span key={item.path} onClick={() => navigate(item.path)} style={{
              cursor: 'pointer', fontSize: '0.85rem',
              fontWeight: isActive ? 600 : 450,
              color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
              transition: 'color 0.2s, background 0.2s',
              padding: '6px 14px', borderRadius: '6px',
              background: isActive ? 'rgba(255,255,255,0.05)' : 'transparent',
            }}
              onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.color = 'var(--text-primary)'; }}
              onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.color = 'var(--text-secondary)'; }}
            >{item.label}</span>
          );
        })}
      </nav>

      {/* Right Side */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <ConnectButton.Custom>
          {({ account, chain, openConnectModal, openAccountModal, openChainModal, mounted }) => {
            const connected = mounted && account && chain;
            if (!mounted) return null;

            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {!connected ? (
                  <button onClick={openConnectModal} className="connect-wallet-fancy connect-wallet-fancy--header">
                    <span className="connect-wallet-fancy__text">CONNECT WALLET</span>
                  </button>
                ) : (
                  <>
                    <UserDropdown />

                    {/* Deposit Button */}
                    <button onClick={() => setDepositOpen(true)} style={{
                      padding: '0 14px', height: '38px', background: 'rgba(91, 138, 114, 0.1)',
                      color: 'var(--accent-success)', fontWeight: 600, borderRadius: '10px',
                      border: '1px solid rgba(91, 138, 114, 0.25)', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: '6px',
                      fontSize: '0.85rem', transition: 'all 0.2s', fontFamily: 'inherit',
                    }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(91, 138, 114, 0.15)'; e.currentTarget.style.borderColor = 'rgba(91, 138, 114, 0.4)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(91, 138, 114, 0.1)'; e.currentTarget.style.borderColor = 'rgba(91, 138, 114, 0.25)'; }}
                    >
                      Deposit
                    </button>

                    {/* Network Button */}
                    {(() => {
                      const currentChainId = wagmiChain?.id || chain.id;
                      const isWrongNetwork = currentChainId !== 10740 || chain.unsupported;
                      return (
                        <button onClick={openChainModal} style={{
                          background: isWrongNetwork ? 'rgba(199, 80, 80, 0.1)' : 'rgba(255,255,255,0.04)',
                          border: isWrongNetwork ? '1px solid rgba(199, 80, 80, 0.2)' : '1px solid rgba(255,255,255,0.08)',
                          borderRadius: '10px', padding: '0 12px', height: '38px', cursor: 'pointer',
                          color: isWrongNetwork ? 'var(--accent-danger)' : '#e8e8e8',
                          fontSize: '0.85rem', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '6px',
                          transition: 'all 0.2s', fontWeight: 500,
                        }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = isWrongNetwork ? 'rgba(199, 80, 80, 0.15)' : 'rgba(255,255,255,0.08)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = isWrongNetwork ? 'rgba(199, 80, 80, 0.1)' : 'rgba(255,255,255,0.04)'; }}
                        >
                          {!isWrongNetwork && chain.hasIcon && chain.iconUrl && (
                            <img src={chain.iconUrl} alt={chain.name ?? ''} style={{ width: 18, height: 18, borderRadius: 4 }} />
                          )}

                          {isWrongNetwork ? (
                            <>
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                              <span style={{ fontSize: '0.8rem', letterSpacing: '0.02em', fontWeight: 600 }}>Wrong Network</span>
                            </>
                          ) : (
                            <span style={{ fontSize: '0.8rem', letterSpacing: '0.02em' }}>OG Testnet</span>
                          )}
                        </button>
                      );
                    })()}

                    {/* Profile Button with Dropdown */}
                    <div ref={walletDropdownRef} style={{ position: 'relative' }}>
                      <button onClick={() => { setWalletDropdownOpen(!walletDropdownOpen); setCopied(false); }} style={{
                        background: walletDropdownOpen ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '10px', padding: '0 12px', height: '38px', cursor: 'pointer', color: '#e8e8e8',
                        fontSize: '0.85rem', fontWeight: 600, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '8px',
                        transition: 'all 0.2s'
                      }}
                        onMouseEnter={(e) => { if (!walletDropdownOpen) e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
                        onMouseLeave={(e) => { if (!walletDropdownOpen) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                      >
                        <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: 'linear-gradient(45deg, var(--accent-primary), #6bedb5)' }} />
                        {account.displayName}
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                          style={{ transition: 'transform 0.25s ease', transform: walletDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)', opacity: 0.5 }}
                        ><path d="m6 9 6 6 6-6" /></svg>
                      </button>

                      {walletDropdownOpen && (
                        <div style={{
                          position: 'absolute', right: 0, top: '100%', marginTop: '10px',
                          background: 'rgba(10, 10, 10, 0.97)', border: '1px solid rgba(196, 163, 90, 0.15)',
                          borderRadius: '12px', padding: '6px', minWidth: '200px', zIndex: 200,
                          boxShadow: '0 12px 48px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.03) inset',
                          backdropFilter: 'blur(24px)',
                        }}>
                          {/* Copy Address */}
                          <div
                            style={{
                              padding: '10px 14px', borderRadius: '8px', cursor: 'pointer',
                              color: copied ? 'var(--accent-success)' : 'var(--text-secondary)',
                              fontSize: '0.85rem', fontWeight: 500,
                              display: 'flex', alignItems: 'center', gap: '10px',
                              transition: 'all 0.2s',
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(91, 138, 114, 0.08)'; e.currentTarget.style.color = '#fff'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = copied ? 'var(--accent-success)' : 'var(--text-secondary)'; }}
                            onClick={() => {
                              if (account.address) {
                                navigator.clipboard.writeText(account.address);
                                setCopied(true);
                                setTimeout(() => setCopied(false), 2000);
                              }
                            }}
                          >
                            {copied ? (
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-success)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            ) : (
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect width="14" height="14" x="8" y="8" rx="2" ry="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                              </svg>
                            )}
                            {copied ? 'Скопировано!' : 'Скопировать адрес'}
                          </div>

                          {/* Divider */}
                          <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '4px 8px' }} />

                          {/* Disconnect */}
                          <div
                            style={{
                              padding: '10px 14px', borderRadius: '8px', cursor: 'pointer',
                              color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 500,
                              display: 'flex', alignItems: 'center', gap: '10px',
                              transition: 'all 0.2s',
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(199, 80, 80, 0.1)'; e.currentTarget.style.color = '#e05555'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (connector) {
                                disconnect({ connector });
                              } else {
                                disconnect();
                              }
                            }}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
                            </svg>
                            Отключить
                          </div>
                        </div>
                      )}
                    </div>

                  </>
                )}
              </div>
            );
          }}
        </ConnectButton.Custom>

        <DepositModal isOpen={isDepositOpen} onClose={() => setDepositOpen(false)} depositAddress={depositAddress} />
      </div>
    </header>
  );
}
