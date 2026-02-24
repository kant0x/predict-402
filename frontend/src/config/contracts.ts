// Contract addresses (deployed on OpenGradient Testnet v2, Chain ID 10740)
export const PREDICT402_ADDRESS = '0xc0d3b105382E60c2a89cfdB83919ebb43bD977fE' as const;
export const VAULT402_ADDRESS = '0xbE40088fe45E58e0655248af05B6feaBA91A518C' as const;

export const GAME_ADDRESS = PREDICT402_ADDRESS;

// Predict402 Contract ABI (matches Predict402.sol)
export const PREDICT402_ABI = [
    // Events
    {
        type: 'event',
        name: 'BetPlaced',
        inputs: [
            { name: 'player', type: 'address', indexed: true },
            { name: 'roundId', type: 'uint256', indexed: true },
            { name: 'isUp', type: 'bool', indexed: false },
            { name: 'amount', type: 'uint256', indexed: false },
            { name: 'nickname', type: 'string', indexed: false },
            { name: 'usedAi', type: 'bool', indexed: false },
        ],
    },
    {
        type: 'event',
        name: 'RoundStarted',
        inputs: [
            { name: 'roundId', type: 'uint256', indexed: true },
            { name: 'strikePrice', type: 'uint256', indexed: false },
            { name: 'startTime', type: 'uint256', indexed: false },
            { name: 'endTime', type: 'uint256', indexed: false },
        ],
    },
    {
        type: 'event',
        name: 'RoundResolved',
        inputs: [
            { name: 'roundId', type: 'uint256', indexed: true },
            { name: 'upWon', type: 'bool', indexed: false },
            { name: 'closingPrice', type: 'uint256', indexed: false },
            { name: 'upPool', type: 'uint256', indexed: false },
            { name: 'downPool', type: 'uint256', indexed: false },
            { name: 'totalPool', type: 'uint256', indexed: false },
        ],
    },
    {
        type: 'event',
        name: 'Payout',
        inputs: [
            { name: 'player', type: 'address', indexed: true },
            { name: 'amount', type: 'uint256', indexed: false },
        ],
    },
    {
        type: 'event',
        name: 'NicknameRegistered',
        inputs: [
            { name: 'player', type: 'address', indexed: true },
            { name: 'nickname', type: 'string', indexed: false },
        ],
    },

    // Read Functions
    {
        type: 'function',
        name: 'currentRoundId',
        inputs: [],
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'roundEndTime',
        inputs: [],
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'getStrikePrice',
        inputs: [],
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'roundDuration',
        inputs: [],
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'totalPool',
        inputs: [],
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'getUpPool',
        inputs: [],
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'getDownPool',
        inputs: [],
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'nicknames',
        inputs: [{ name: 'player', type: 'address' }],
        outputs: [{ name: '', type: 'string' }],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'getCurrentRoundBets',
        inputs: [],
        outputs: [
            {
                name: '',
                type: 'tuple[]',
                components: [
                    { name: 'player', type: 'address' },
                    { name: 'isUp', type: 'bool' },
                    { name: 'amount', type: 'uint256' },
                    { name: 'shares', type: 'uint256' },
                    { name: 'nickname', type: 'string' },
                    { name: 'usedAiPrediction', type: 'bool' },
                    { name: 'fromVault', type: 'bool' },
                ],
            },
        ],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'getBets',
        inputs: [{ name: 'roundId', type: 'uint256' }],
        outputs: [
            {
                name: '',
                type: 'tuple[]',
                components: [
                    { name: 'player', type: 'address' },
                    { name: 'isUp', type: 'bool' },
                    { name: 'amount', type: 'uint256' },
                    { name: 'shares', type: 'uint256' },
                    { name: 'nickname', type: 'string' },
                    { name: 'usedAiPrediction', type: 'bool' },
                    { name: 'fromVault', type: 'bool' },
                ],
            },
        ],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'getLeaderboard',
        inputs: [],
        outputs: [
            {
                name: '',
                type: 'tuple[]',
                components: [
                    { name: 'player', type: 'address' },
                    { name: 'nickname', type: 'string' },
                    { name: 'totalWins', type: 'uint256' },
                    { name: 'totalBets', type: 'uint256' },
                    { name: 'totalEarnings', type: 'uint256' },
                    { name: 'winRate', type: 'uint256' },
                ],
            },
        ],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'getRoundInfo',
        inputs: [{ name: 'roundId', type: 'uint256' }],
        outputs: [
            {
                name: '',
                type: 'tuple',
                components: [
                    { name: 'startTime', type: 'uint256' },
                    { name: 'endTime', type: 'uint256' },
                    { name: 'strikePrice', type: 'uint256' },
                    { name: 'closingPrice', type: 'uint256' },
                    { name: 'upPool', type: 'uint256' },
                    { name: 'downPool', type: 'uint256' },
                    { name: 'totalPool', type: 'uint256' },
                    { name: 'upShares', type: 'uint256' },
                    { name: 'downShares', type: 'uint256' },
                    { name: 'totalBets', type: 'uint256' },
                    { name: 'resolved', type: 'bool' },
                    { name: 'upWon', type: 'bool' },
                    { name: 'proofHash', type: 'string' },
                ],
            },
        ],
        stateMutability: 'view',
    },

    // Write Functions
    {
        type: 'function',
        name: 'registerNickname',
        inputs: [{ name: 'nickname', type: 'string' }],
        outputs: [],
        stateMutability: 'nonpayable',
    },
    {
        type: 'function',
        name: 'placeBet',
        inputs: [{ name: '_isUp', type: 'bool' }],
        outputs: [],
        stateMutability: 'payable',
    },
] as const;

// Backward compat alias
export const VAULT402_ABI = PREDICT402_ABI;

// Round duration in seconds (5 minutes)
export const ROUND_DURATION = 5 * 60;
