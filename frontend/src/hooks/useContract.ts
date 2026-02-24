import { useReadContract, useWriteContract, useWaitForTransactionReceipt, useWalletClient, usePublicClient } from 'wagmi';
import { parseEther } from 'viem';
import { useState, useCallback, useEffect } from 'react';
import { PREDICT402_ABI, ROUND_DURATION } from '../config/contracts';
import { PREDICT402_ADDRESS } from '../config/contracts';

const IS_DEMO = false;

export function useRoundSync() {
    const [intervalMs, setIntervalMs] = useState(15_000);

    const { data: roundIdData } = useReadContract({
        address: PREDICT402_ADDRESS,
        abi: PREDICT402_ABI,
        functionName: 'currentRoundId',
        query: { enabled: !IS_DEMO, refetchInterval: intervalMs },
    });
    const { data: endTimeData } = useReadContract({
        address: PREDICT402_ADDRESS,
        abi: PREDICT402_ABI,
        functionName: 'roundEndTime',
        query: { enabled: !IS_DEMO, refetchInterval: intervalMs },
    });

    const endTime = endTimeData ? Number(endTimeData) : 0;

    useEffect(() => {
        if (!endTime) {
            setIntervalMs(15_000);
            return;
        }

        const updateInterval = () => {
            const now = Math.floor(Date.now() / 1000);
            const remaining = endTime - now;
            // Aggressive 1s polling when <= 5 seconds remain or while resolving
            setIntervalMs(remaining <= 5 ? 1_000 : 15_000);
        };

        updateInterval();
        const checkInterval = setInterval(updateInterval, 1000);
        return () => clearInterval(checkInterval);
    }, [endTime]);

    if (IS_DEMO) return { roundId: 1, interval: 60_000 };

    const roundId = roundIdData ? Number(roundIdData) : 0;

    return { roundId, interval: intervalMs };
}

export function useCurrentRoundId() {
    const { interval } = useRoundSync();
    const { data, isLoading, error } = useReadContract({
        address: PREDICT402_ADDRESS,
        abi: PREDICT402_ABI,
        functionName: 'currentRoundId',
        query: { enabled: !IS_DEMO, refetchInterval: interval },
    });
    if (IS_DEMO) {
        const now = Math.floor(Date.now() / 1000);
        return { roundId: Math.floor(now / ROUND_DURATION), isLoading: false, error: null };
    }
    return { roundId: data ? Number(data) : 0, isLoading, error };
}

export function useRoundEndTime() {
    const { interval } = useRoundSync();
    const { data, isLoading, error } = useReadContract({
        address: PREDICT402_ADDRESS,
        abi: PREDICT402_ABI,
        functionName: 'roundEndTime',
        query: { enabled: !IS_DEMO, refetchInterval: interval },
    });
    if (IS_DEMO) {
        const now = Math.floor(Date.now() / 1000);
        const roundId = Math.floor(now / ROUND_DURATION);
        return { endTime: (roundId + 1) * ROUND_DURATION, isLoading: false, error: null };
    }
    return { endTime: data ? Number(data) : 0, isLoading, error };
}

export function useStrikePrice() {
    const { roundId, interval } = useRoundSync();
    const { data, isLoading, error } = useReadContract({
        address: PREDICT402_ADDRESS,
        abi: PREDICT402_ABI,
        functionName: 'getStrikePrice',
        query: { enabled: !IS_DEMO && roundId > 0, refetchInterval: interval },
    });
    // Strike price is stored in cents in the contract
    return { strikePrice: data ? Number(data) / 100 : null, isLoading, error };
}

export function useTotalPool() {
    const { roundId, interval } = useRoundSync();
    const { data, isLoading } = useReadContract({
        address: PREDICT402_ADDRESS,
        abi: PREDICT402_ABI,
        functionName: 'totalPool',
        query: { enabled: !IS_DEMO && roundId > 0, refetchInterval: interval },
    });
    return { totalPool: data ? data as bigint : BigInt(0), isLoading };
}

export function useUpPool() {
    const { roundId, interval } = useRoundSync();
    const { data, isLoading } = useReadContract({
        address: PREDICT402_ADDRESS,
        abi: PREDICT402_ABI,
        functionName: 'getUpPool',
        query: { enabled: !IS_DEMO && roundId > 0, refetchInterval: interval },
    });
    return { upPool: data ? data as bigint : BigInt(0), isLoading };
}

export function useDownPool() {
    const { roundId, interval } = useRoundSync();
    const { data, isLoading } = useReadContract({
        address: PREDICT402_ADDRESS,
        abi: PREDICT402_ABI,
        functionName: 'getDownPool',
        query: { enabled: !IS_DEMO && roundId > 0, refetchInterval: interval },
    });
    return { downPool: data ? data as bigint : BigInt(0), isLoading };
}

export function useNickname(address: `0x${string}` | undefined) {
    const { data, isLoading } = useReadContract({
        address: PREDICT402_ADDRESS,
        abi: PREDICT402_ABI,
        functionName: 'nicknames',
        args: address ? [address] : undefined,
        query: { enabled: !IS_DEMO && !!address },
    });
    if (IS_DEMO && address) {
        const saved = localStorage.getItem(`vault402_nick_${address}`);
        return { nickname: saved || '', isLoading: false };
    }
    return { nickname: (data as string) || '', isLoading };
}

export function useCurrentRoundBets() {
    // Disabled: causes 'execution reverted', not used in components
    return { bets: [] as any[], isLoading: false, refetch: () => { } };
}

export function useLeaderboard() {
    const { data, isLoading } = useReadContract({
        address: PREDICT402_ADDRESS,
        abi: PREDICT402_ABI,
        functionName: 'getLeaderboard',
        query: { enabled: !IS_DEMO, refetchInterval: 60_000 },
    });
    return { leaderboard: (data as any[]) || [], isLoading };
}

export function useRegisterNickname() {
    const { writeContract, data: hash, isPending: isWriting, error: writeError } = useWriteContract();
    const { isLoading: isConfirming, isSuccess, error: confirmError } = useWaitForTransactionReceipt({ hash });

    const register = useCallback(
        (nickname: string) => {
            if (IS_DEMO) return;
            writeContract({
                address: PREDICT402_ADDRESS,
                abi: PREDICT402_ABI,
                functionName: 'registerNickname',
                args: [nickname],
                gas: BigInt(2_000_000),
                type: 'legacy',
            });
        },
        [writeContract]
    );

    return { register, isPending: isWriting || isConfirming, isSuccess, error: writeError || confirmError, txHash: hash };
}

export function usePlaceBet() {
    const { writeContract, data: hash, isPending, error } = useWriteContract();
    const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

    const placeBet = useCallback(
        (isUp: boolean, amountEth: string) => {
            if (IS_DEMO) return;
            writeContract({
                address: PREDICT402_ADDRESS,
                abi: PREDICT402_ABI,
                functionName: 'placeBet',
                args: [isUp],
                value: parseEther(amountEth),
                gas: BigInt(3_000_000),
                type: 'legacy',
            });
        },
        [writeContract]
    );

    return { placeBet, isPending: isPending || isConfirming, isSuccess, error, txHash: hash };
}

export function useContractMode() {
    const [mode] = useState<'demo' | 'live'>(IS_DEMO ? 'demo' : 'live');
    return {
        mode,
        isDemo: IS_DEMO,
        contractAddress: PREDICT402_ADDRESS,
        rpcUrl: 'https://ogevmdevnet.opengradient.ai',
        chainId: 10740,
        explorerUrl: `https://explorer.opengradient.ai/address/${PREDICT402_ADDRESS}`,
    };
}
