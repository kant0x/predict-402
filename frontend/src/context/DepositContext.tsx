import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { useAccount } from 'wagmi';

interface DepositState {
    depositAddress: string | null;
    balances: { eth: number; ousdc: number };
    refresh: () => void;
    isLoading: boolean;
}

const DepositContext = createContext<DepositState | null>(null);

export const ORACLE_API = import.meta.env.VITE_ORACLE_API || 'http://localhost:3402';

export function DepositProvider({ children }: { children: ReactNode }) {
    const { address } = useAccount();
    const [depositAddress, setDepositAddress] = useState<string | null>(null);
    const [balances, setBalances] = useState({ eth: 0, ousdc: 0 });
    const [isLoading, setIsLoading] = useState(false);

    const fetchWallet = async () => {
        if (!address) return;
        setIsLoading(true);
        try {
            const res = await fetch(`${ORACLE_API}/api/user/init`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ player: address }),
            });
            const data = await res.json();
            if (data.deposit_address) {
                setDepositAddress(data.deposit_address);
                setBalances(data.balances || { eth: 0, ousdc: 0 });
            }
        } catch (e) {
            console.error("Deposit init error:", e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchWallet();
        const interval = setInterval(fetchWallet, 30_000);
        return () => clearInterval(interval);
    }, [address]);

    return (
        <DepositContext.Provider value={{ depositAddress, balances, refresh: fetchWallet, isLoading }}>
            {children}
        </DepositContext.Provider>
    );
}

export function useDeposit() {
    const ctx = useContext(DepositContext);
    if (!ctx) throw new Error("useDeposit must be used within DepositProvider");
    return ctx;
}
