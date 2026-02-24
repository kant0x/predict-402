import { useState } from 'react';
import ReactDOM from 'react-dom';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract, useChainId, useSwitchChain } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import { VAULT402_ADDRESS } from '../config/contracts';

const VAULT402_DEPOSIT_ABI = [
    { type: 'function', name: 'deposit', inputs: [], outputs: [], stateMutability: 'payable' },
    { type: 'function', name: 'balances', inputs: [{ name: '', type: 'address' }], outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view' },
    { type: 'function', name: 'withdraw', inputs: [{ name: '_amount', type: 'uint256' }], outputs: [], stateMutability: 'nonpayable' },
    { type: 'function', name: 'autoBetEnabled', inputs: [{ name: '', type: 'address' }], outputs: [{ name: '', type: 'bool' }], stateMutability: 'view' },
    { type: 'function', name: 'toggleAutoBet', inputs: [{ name: 'enabled', type: 'bool' }], outputs: [], stateMutability: 'nonpayable' },
] as const;

interface DepositModalProps {
    isOpen: boolean;
    onClose: () => void;
    depositAddress: string | null;
}

const CrossIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
);

const CheckIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-success)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
    </svg>
);

const CopyIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
);

const WarningIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><path d="M12 9v4" /><path d="M12 17h.01" />
    </svg>
);

const VaultIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="6" width="20" height="14" rx="2" /><path d="M2 10h20" /><path d="M12 6v4" /><circle cx="12" cy="16" r="2" />
    </svg>
);

const SpinnerSmall = () => (
    <div style={{ width: '16px', height: '16px', border: '2px solid var(--accent-primary)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />
);

export function DepositModal({ isOpen, onClose, depositAddress }: DepositModalProps) {
    const [copied, setCopied] = useState(false);
    const [amount, setAmount] = useState('0.01');
    const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw'>('deposit');
    const { address, isConnected } = useAccount();
    const chainId = useChainId();
    const { switchChain } = useSwitchChain();

    const { data: vaultBalance, refetch: refetchBalance } = useReadContract({
        address: VAULT402_ADDRESS, abi: VAULT402_DEPOSIT_ABI, functionName: 'balances',
        args: address ? [address] : undefined,
        query: { enabled: !!address, refetchInterval: 10_000 },
    });

    const { data: isAutoBetEnabled, refetch: refetchAutoBet } = useReadContract({
        address: VAULT402_ADDRESS, abi: VAULT402_DEPOSIT_ABI, functionName: 'autoBetEnabled',
        args: address ? [address] : undefined,
        query: { enabled: !!address, refetchInterval: 10_000 },
    });

    const { writeContract: writeDeposit, data: depositHash, isPending: isDepositing, error: depositError } = useWriteContract();
    const { isLoading: isDepositConfirming, isSuccess: depositSuccess } = useWaitForTransactionReceipt({ hash: depositHash });

    const { writeContract: writeWithdraw, data: withdrawHash, isPending: isWithdrawing, error: withdrawError } = useWriteContract();
    const { isLoading: isWithdrawConfirming, isSuccess: withdrawSuccess } = useWaitForTransactionReceipt({ hash: withdrawHash });

    const { writeContract: writeToggle, data: toggleHash, isPending: isToggling, error: toggleError } = useWriteContract();
    const { isLoading: isToggleConfirming, isSuccess: toggleSuccess } = useWaitForTransactionReceipt({ hash: toggleHash });

    if (!isOpen) return null;

    const handleCopy = () => {
        if (depositAddress) { navigator.clipboard.writeText(depositAddress); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    };

    const handleDeposit = () => {
        if (!address || !amount || parseFloat(amount) <= 0 || wrongChain) return;
        try {
            writeDeposit({ address: VAULT402_ADDRESS, abi: VAULT402_DEPOSIT_ABI, functionName: 'deposit', value: parseEther(amount), gas: BigInt(2_000_000), type: 'legacy' });
        } catch (e) { console.error('Deposit error:', e); }
    };

    const handleWithdraw = () => {
        if (!address || !amount || parseFloat(amount) <= 0 || wrongChain) return;
        writeWithdraw({ address: VAULT402_ADDRESS, abi: VAULT402_DEPOSIT_ABI, functionName: 'withdraw', args: [parseEther(amount)], gas: BigInt(2_000_000), type: 'legacy' });
    };

    const handleWithdrawAll = () => {
        if (!address || wrongChain) return;
        writeWithdraw({ address: VAULT402_ADDRESS, abi: VAULT402_DEPOSIT_ABI, functionName: 'withdraw', args: [BigInt(0)], gas: BigInt(2_000_000), type: 'legacy' });
    };

    const handleToggleAutoBet = () => {
        if (wrongChain) return;
        writeToggle({ address: VAULT402_ADDRESS, abi: VAULT402_DEPOSIT_ABI, functionName: 'toggleAutoBet', args: [!isAutoBetEnabled], gas: BigInt(2_000_000), type: 'legacy' });
    };

    if (depositSuccess || withdrawSuccess || toggleSuccess) {
        refetchBalance();
        refetchAutoBet();
    }

    const balanceFormatted = vaultBalance ? formatEther(vaultBalance as bigint) : '0';
    const isPending = isDepositing || isDepositConfirming || isWithdrawing || isWithdrawConfirming || isToggling || isToggleConfirming;
    const txError = depositError || withdrawError || toggleError;
    const wrongChain = chainId !== 10740;

    const getDepositStatus = () => {
        if (isDepositing) return 'Confirming...';
        if (isDepositConfirming) return 'Mining...';
        if (depositSuccess) return 'Deposited!';
        return `Deposit ${amount} ETH`;
    };

    const getWithdrawStatus = () => {
        if (isWithdrawing) return 'Confirming...';
        if (isWithdrawConfirming) return 'Mining...';
        if (withdrawSuccess) return 'Withdrawn!';
        return `Withdraw ${amount} ETH`;
    };

    return ReactDOM.createPortal(
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(16px)',
            zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
        }} onClick={onClose}>
            <div style={{
                background: 'rgba(10, 10, 10, 0.97)',
                padding: '1.75rem', borderRadius: 'var(--radius-lg)',
                border: '1px solid rgba(196, 163, 90, 0.12)', maxWidth: '420px', width: '100%',
                boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
                position: 'relative', maxHeight: '90vh', overflowY: 'auto',
                backdropFilter: 'blur(20px)',
            }} onClick={e => e.stopPropagation()}>

                {/* Close */}
                <button onClick={onClose} style={{
                    position: 'absolute', top: '14px', right: '14px',
                    background: 'rgba(255,255,255,0.05)', border: 'none',
                    color: 'var(--text-muted)', cursor: 'pointer',
                    width: '28px', height: '28px', borderRadius: '6px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s',
                }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#fff'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                ><CrossIcon /></button>

                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem' }}>
                    <div style={{
                        width: '36px', height: '36px', borderRadius: '10px',
                        background: 'rgba(91, 138, 114, 0.08)', border: '1px solid rgba(91, 138, 114, 0.15)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-primary)',
                    }}><VaultIcon /></div>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>Vault 402</h2>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Manage your betting balance</div>
                    </div>
                </div>

                {/* Balance */}
                <div style={{
                    background: 'rgba(91, 138, 114, 0.06)', padding: '14px 16px',
                    borderRadius: 'var(--radius-md)', border: '1px solid rgba(91, 138, 114, 0.12)',
                    marginBottom: '1.25rem', textAlign: 'center',
                }}>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>Your Vault Balance</div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                        {parseFloat(balanceFormatted).toFixed(4)}
                        <span style={{ fontSize: '0.8rem', color: 'var(--accent-primary)', marginLeft: '6px' }}>ETH</span>
                    </div>
                    {wrongChain && (
                        <div style={{ fontSize: '0.75rem', color: '#ffa500', marginTop: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                            <WarningIcon /> Switch to OpenGradient Testnet
                            <button onClick={() => switchChain({ chainId: 10740 })} style={{
                                marginLeft: '4px', padding: '2px 8px', borderRadius: '4px',
                                border: '1px solid #ffa500', background: 'transparent', color: '#ffa500', cursor: 'pointer', fontSize: '0.7rem', fontFamily: 'inherit',
                            }}>Switch</button>
                        </div>
                    )}
                </div>

                {/* Auto-Bet Settings */}
                {isConnected && (
                    <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '12px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px',
                        border: '1px solid rgba(255,255,255,0.06)', marginBottom: '1.25rem',
                    }}>
                        <div>
                            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>AI Auto-Bet</div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>Let Oracle trade with your balance</div>
                        </div>
                        <button
                            onClick={handleToggleAutoBet}
                            disabled={isPending || wrongChain}
                            style={{
                                width: '44px', height: '24px', borderRadius: '12px',
                                background: isAutoBetEnabled ? 'var(--accent-success)' : 'rgba(255,255,255,0.1)',
                                border: 'none', position: 'relative', cursor: isPending ? 'wait' : 'pointer',
                                transition: 'background 0.3s',
                            }}
                        >
                            <div style={{
                                width: '20px', height: '20px', borderRadius: '50%', background: '#fff',
                                position: 'absolute', top: '2px', left: isAutoBetEnabled ? '22px' : '2px',
                                transition: 'left 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                            }} />
                        </button>
                    </div>
                )}

                {/* Tabs */}
                <div style={{ display: 'flex', gap: '4px', marginBottom: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '3px' }}>
                    {(['deposit', 'withdraw'] as const).map(tab => (
                        <button key={tab} onClick={() => setActiveTab(tab)} style={{
                            flex: 1, padding: '9px', borderRadius: '6px', border: 'none',
                            background: activeTab === tab ? 'rgba(91, 138, 114, 0.15)' : 'transparent',
                            color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-muted)',
                            fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', fontSize: '0.85rem', fontFamily: 'inherit',
                        }}>{tab === 'deposit' ? 'Deposit' : 'Withdraw'}</button>
                    ))}
                </div>

                {/* Amount Input */}
                <div style={{ marginBottom: '1rem' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Amount (ETH)</div>
                    <div>
                        <input type="number" step="0.001" min="0" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.01"
                            style={{
                                width: '100%', padding: '12px 14px', borderRadius: '8px',
                                border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.03)',
                                color: 'var(--text-primary)', fontSize: '1.05rem', fontFamily: 'var(--font-mono)',
                                outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s',
                            }}
                            onFocus={e => e.currentTarget.style.borderColor = 'rgba(91, 138, 114, 0.35)'}
                            onBlur={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'}
                        />
                        <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                            {['0.005', '0.01', '0.02', '0.05'].map(val => (
                                <button key={val} onClick={() => setAmount(val)} style={{
                                    flex: 1, padding: '6px', borderRadius: '6px',
                                    border: '1px solid rgba(255,255,255,0.06)',
                                    background: amount === val ? 'rgba(91, 138, 114, 0.12)' : 'rgba(255,255,255,0.03)',
                                    color: amount === val ? 'var(--accent-primary)' : 'var(--text-muted)',
                                    cursor: 'pointer', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', transition: 'all 0.2s',
                                }}>{val}</button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Action Button */}
                {activeTab === 'deposit' ? (
                    <button onClick={handleDeposit} disabled={isPending || !amount || parseFloat(amount) <= 0 || wrongChain} style={{
                        width: '100%', padding: '13px', borderRadius: '8px',
                        border: '1px solid rgba(91, 138, 114, 0.25)',
                        background: isPending ? 'rgba(255,255,255,0.03)' : 'rgba(91, 138, 114, 0.1)',
                        color: isPending ? 'var(--text-muted)' : 'var(--accent-primary)',
                        fontWeight: 700, fontSize: '0.9rem', cursor: isPending ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s', marginBottom: '10px', fontFamily: 'inherit',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    }}
                        onMouseEnter={(e) => { if (!isPending) { e.currentTarget.style.background = 'rgba(91, 138, 114, 0.18)'; e.currentTarget.style.borderColor = 'rgba(91, 138, 114, 0.4)'; } }}
                        onMouseLeave={(e) => { if (!isPending) { e.currentTarget.style.background = 'rgba(91, 138, 114, 0.1)'; e.currentTarget.style.borderColor = 'rgba(91, 138, 114, 0.25)'; } }}
                    >
                        {isPending && <SpinnerSmall />}
                        {depositSuccess && <CheckIcon />}
                        {getDepositStatus()}
                    </button>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '10px' }}>
                        <button onClick={handleWithdraw} disabled={isPending || !amount || parseFloat(amount) <= 0 || wrongChain} style={{
                            width: '100%', padding: '13px', borderRadius: '8px',
                            border: '1px solid rgba(199, 80, 80, 0.25)',
                            background: isPending ? 'rgba(255,255,255,0.03)' : 'rgba(199, 80, 80, 0.08)',
                            color: isPending ? 'var(--text-muted)' : 'var(--accent-danger)',
                            fontWeight: 700, fontSize: '0.9rem', cursor: isPending ? 'not-allowed' : 'pointer',
                            transition: 'all 0.2s', fontFamily: 'inherit',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                        }}
                            onMouseEnter={(e) => { if (!isPending) { e.currentTarget.style.background = 'rgba(199, 80, 80, 0.15)'; } }}
                            onMouseLeave={(e) => { if (!isPending) { e.currentTarget.style.background = 'rgba(199, 80, 80, 0.08)'; } }}
                        >
                            {isPending && <SpinnerSmall />}
                            {withdrawSuccess && <CheckIcon />}
                            {getWithdrawStatus()}
                        </button>
                        <button onClick={handleWithdrawAll} disabled={isPending || !vaultBalance || (vaultBalance as bigint) === BigInt(0) || wrongChain} style={{
                            width: '100%', padding: '9px', borderRadius: '8px',
                            border: '1px solid rgba(255,255,255,0.06)', background: 'transparent',
                            color: 'var(--text-muted)', fontWeight: 600, cursor: 'pointer', fontSize: '0.8rem',
                            transition: 'all 0.2s', fontFamily: 'inherit',
                        }}
                            onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; }}
                            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; }}
                        >Withdraw All</button>
                    </div>
                )}

                {/* Connection Warning */}
                {!isConnected && (
                    <div style={{
                        padding: '10px 12px', borderRadius: '8px', marginBottom: '10px',
                        background: 'rgba(255, 165, 0, 0.06)', border: '1px solid rgba(255, 165, 0, 0.15)',
                        color: '#ffa500', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '8px',
                    }}><WarningIcon /> Wallet not connected.</div>
                )}

                {/* Error */}
                {txError && (
                    <div style={{
                        padding: '10px 12px', borderRadius: '8px', marginBottom: '10px',
                        background: 'rgba(199, 80, 80, 0.06)', border: '1px solid rgba(199, 80, 80, 0.15)',
                        color: 'var(--accent-danger)', fontSize: '0.8rem', wordBreak: 'break-word',
                        display: 'flex', alignItems: 'flex-start', gap: '8px',
                    }}>
                        <CrossIcon />
                        <span>{txError.message?.includes('User rejected') ? 'Transaction rejected' : txError.message?.includes('insufficient') ? 'Insufficient ETH balance' : txError.message?.slice(0, 150) || 'Transaction failed'}</span>
                    </div>
                )}

                {/* Contract Address */}
                <details style={{ marginTop: '12px' }}>
                    <summary style={{
                        cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.75rem',
                        listStyle: 'none', textAlign: 'center', padding: '6px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                    }}><CopyIcon /> Vault Contract Address</summary>
                    <div onClick={handleCopy} style={{
                        background: 'rgba(255,255,255,0.02)', padding: '10px 12px', borderRadius: '8px',
                        border: '1px dashed rgba(91, 138, 114, 0.15)', cursor: 'pointer',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', transition: 'all 0.2s',
                    }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(91, 138, 114, 0.06)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                    >
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', wordBreak: 'break-all', color: 'var(--text-muted)' }}>{VAULT402_ADDRESS}</span>
                        {copied ? <CheckIcon /> : <CopyIcon />}
                    </div>
                </details>

                {/* Faucet */}
                <a href="https://faucet.opengradient.ai" target="_blank" rel="noopener noreferrer" style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                    marginTop: '12px', color: 'var(--accent-primary)', fontSize: '0.8rem', textDecoration: 'none', transition: 'opacity 0.2s',
                }}
                    onMouseEnter={e => e.currentTarget.style.opacity = '0.7'}
                    onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" /></svg>
                    Need test tokens? Get from Faucet
                </a>
            </div>
        </div>,
        document.body
    );
}
