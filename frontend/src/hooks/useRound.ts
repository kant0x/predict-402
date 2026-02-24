import { useState, useEffect, useCallback } from 'react';
import { ROUND_DURATION } from '../config/contracts';

interface RoundState {
    roundId: number;
    roundEndTime: number;
    isActive: boolean;
}

export function useRound() {
    const calcRound = useCallback(() => {
        const now = Math.floor(Date.now() / 1000);
        const roundId = Math.floor(now / ROUND_DURATION);
        const roundEndTime = (roundId + 1) * ROUND_DURATION;
        return { roundId, roundEndTime, isActive: true };
    }, []);

    const [round, setRound] = useState<RoundState>(calcRound);

    useEffect(() => {
        const interval = setInterval(() => {
            setRound(calcRound());
        }, 1000);
        return () => clearInterval(interval);
    }, [calcRound]);

    const onRoundExpire = useCallback(() => {
        setRound(calcRound());
    }, [calcRound]);

    return { ...round, onRoundExpire };
}
