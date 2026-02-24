// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Predict402 {
    struct Bet {
        address player;
        bool isUp;
        uint256 amount;
        uint256 shares;  // time-weighted: amount * timeLeft / roundDuration
        string nickname;
        bool usedAiPrediction;
        bool fromVault;
    }

    struct RoundInfo {
        uint256 startTime;
        uint256 endTime;
        uint256 strikePrice;
        uint256 closingPrice;
        uint256 upPool;
        uint256 downPool;
        uint256 totalPool;
        uint256 upShares;    // time-weighted sum for UP bettors
        uint256 downShares;  // time-weighted sum for DOWN bettors
        uint256 totalBets;
        bool resolved;
        bool upWon;
        string proofHash;
    }

    struct PlayerStats {
        address player;
        string nickname;
        uint256 totalWins;
        uint256 totalBets;
        uint256 totalEarnings;
        uint256 winRate; // basis points
    }

    address public owner;
    address public aiAgent;
    address public vault;

    uint256 public roundDuration = 5 minutes;
    uint256 public currentRoundId;

    // Комиссия накапливается, раз в сутки агент вызывает distributeFeesToOwner()
    uint256 public accruedFees;
    uint256 public lastFeeDistribution;
    uint256 public constant FEE_INTERVAL = 24 hours;

    // Reentrancy Guard
    uint256 private _status;

    mapping(uint256 => RoundInfo) public rounds;
    mapping(uint256 => Bet[]) public _roundBets;
    mapping(address => string) public nicknames;
    mapping(address => PlayerStats) public playerStats;
    address[] public allPlayers;

    event BetPlaced(address indexed player, uint256 indexed roundId, bool isUp, uint256 amount, string nickname, bool usedAi);
    event RoundStarted(uint256 indexed roundId, uint256 strikePrice, uint256 startTime, uint256 endTime);
    event RoundResolved(uint256 indexed roundId, bool upWon, uint256 closingPrice, uint256 upPool, uint256 downPool, uint256 totalPool);
    event Payout(address indexed player, uint256 amount);
    event FeePaid(address indexed owner, uint256 amount);
    event NicknameRegistered(address indexed player, string nickname);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier onlyAgent() {
        require(msg.sender == aiAgent || msg.sender == owner, "Not authorized");
        _;
    }

    modifier nonReentrant() {
        require(_status != 2, "ReentrancyGuard: reentrant call");
        _status = 2;
        _;
        _status = 1;
    }

    constructor() {
        owner = msg.sender;
        aiAgent = msg.sender;
        _status = 1;
    }

    receive() external payable {}

    // ── Configuration ──

    function setAiAgent(address _agent) external onlyOwner {
        aiAgent = _agent;
    }

    function setVault(address _vault) external onlyOwner {
        vault = _vault;
    }

    /**
     * @notice Публичная функция — любой (включая агента) может вызвать раз в 24ч.
     * Всегда отправляет накопленные комиссии на адрес owner.
     * Owner ключ нигде не нужен — агент вызывает своим ключом.
     */
    function distributeFeesToOwner() external {
        require(block.timestamp >= lastFeeDistribution + FEE_INTERVAL, "Too soon: 24h not passed");
        require(accruedFees > 0, "No fees to distribute");
        uint256 amount = accruedFees;
        accruedFees = 0;
        lastFeeDistribution = block.timestamp;
        payable(owner).transfer(amount);
        emit FeePaid(owner, amount);
    }

    // ── Betting ──

    function registerNickname(string calldata _nickname) external {
        nicknames[msg.sender] = _nickname;
        if (playerStats[msg.sender].player == address(0)) {
            playerStats[msg.sender] = PlayerStats(msg.sender, _nickname, 0, 0, 0, 0);
            allPlayers.push(msg.sender);
        }
        emit NicknameRegistered(msg.sender, _nickname);
    }

    function placeBet(bool _isUp) external payable nonReentrant {
        _placeBet(msg.sender, _isUp, msg.value, false, false);
    }

    function placeBetFromVault(address _user, bool _isUp) external payable nonReentrant {
        require(msg.sender == vault || msg.sender == owner, "Only vault");
        _placeBet(_user, _isUp, msg.value, false, true);
    }

    function _placeBet(address player, bool isUp, uint256 amount, bool usedAi, bool fromVault) internal {
        require(amount > 0, "Bet amount > 0");
        RoundInfo storage r = rounds[currentRoundId];
        require(r.endTime > block.timestamp, "Round finished");

        // ── Time-weighted shares ──
        // Чем раньше ставишь — тем больше timeLeft — тем больше shares — тем больше прибыль.
        // Ставка за 5 минут до конца → shares = amount (100%)
        // Ставка за 30 секунд до конца → shares = amount * 30/300 = amount * 10%
        uint256 timeLeft = r.endTime - block.timestamp;
        uint256 shares = (amount * timeLeft) / roundDuration;
        if (shares == 0) shares = 1; // минимум 1 share

        string memory nick = nicknames[player];
        if (bytes(nick).length == 0) nick = "Player";

        Bet memory b = Bet(player, isUp, amount, shares, nick, usedAi, fromVault);
        _roundBets[currentRoundId].push(b);

        r.totalPool += amount;
        r.totalBets += 1;
        if (isUp) {
            r.upPool += amount;
            r.upShares += shares;
        } else {
            r.downPool += amount;
            r.downShares += shares;
        }

        playerStats[player].totalBets += 1;
        emit BetPlaced(player, currentRoundId, isUp, amount, nick, usedAi);
    }

    // ── Round Management ──

    function startFirstRound(uint256 _strikePrice) external onlyAgent {
        require(currentRoundId == 0, "Already started");
        _startNewRound(_strikePrice);
    }

    function startNewRound(uint256 _strikePrice) external onlyAgent {
        _startNewRound(_strikePrice);
    }

    function _startNewRound(uint256 _strikePrice) internal {
        currentRoundId++;
        
        // Quantize endTime to strictly 5-minute clock intervals (XX:00, XX:05, XX:10...)
        uint256 remainder = block.timestamp % roundDuration;
        uint256 _endTime = block.timestamp - remainder + roundDuration;

        rounds[currentRoundId] = RoundInfo({
            startTime: block.timestamp,
            endTime: _endTime,
            strikePrice: _strikePrice,
            closingPrice: 0,
            upPool: 0,
            downPool: 0,
            totalPool: 0,
            upShares: 0,
            downShares: 0,
            totalBets: 0,
            resolved: false,
            upWon: false,
            proofHash: ""
        });
        emit RoundStarted(currentRoundId, _strikePrice, block.timestamp, _endTime);
    }

    /**
     * @notice Атомарно закрывает текущий раунд и запускает следующий.
     *
     * Механика выплат (time-weighted early bettor advantage):
     *   - Победители получают обратно свой principal (100%)
     *   - Прибыль = 96% пула проигравших, делится ПРОПОРЦИОНАЛЬНО shares
     *   - shares = amount × timeLeft / roundDuration при ставке
     *   - Кто поставил раньше → больше shares → больше прибыли
     *   - 4% комиссия берётся с пула проигравших
     */
    function resolveAndStart(
        uint256 _closingPrice,
        string calldata _proofHash,
        uint256 _newStrikePrice
    ) external onlyAgent nonReentrant {
        RoundInfo storage r = rounds[currentRoundId];
        require(!r.resolved, "Already resolved");
        require(block.timestamp >= r.endTime, "Not ended");

        r.resolved = true;
        r.closingPrice = _closingPrice;
        r.proofHash = _proofHash;

        bool upWon = _closingPrice > r.strikePrice;
        r.upWon = upWon;

        uint256 winnerPool  = upWon ? r.upPool   : r.downPool;
        uint256 loserPool   = upWon ? r.downPool  : r.upPool;
        uint256 winnerShares = upWon ? r.upShares : r.downShares;

        // 4% комиссия автоматически → owner сразу при резолве
        uint256 fee = loserPool * 4 / 100;
        uint256 profitPool = loserPool - fee; // 96% пула проигравших → победителям

        if (winnerPool > 0 && winnerShares > 0) {
            Bet[] storage bets = _roundBets[currentRoundId];
            for (uint256 i = 0; i < bets.length; i++) {
                Bet memory b = bets[i];
                if (b.isUp == upWon) {
                    uint256 profit = (b.shares * profitPool) / winnerShares;
                    uint256 total = b.amount + profit;

                    if (b.fromVault && vault != address(0)) {
                        (bool success, ) = vault.call{value: total}(
                            abi.encodeWithSignature("creditWinnings(address)", b.player)
                        );
                        require(success, "Vault credit failed");
                    } else {
                        payable(b.player).transfer(total);
                    }
                    emit Payout(b.player, total);
                    playerStats[b.player].totalWins += 1;
                    playerStats[b.player].totalEarnings += total;
                }
            }
        } else {
            // Нет победителей → весь profitPool тоже в комиссию
            fee += profitPool;
        }

        accruedFees += fee;

        emit RoundResolved(currentRoundId, upWon, _closingPrice, r.upPool, r.downPool, r.totalPool);
        _startNewRound(_newStrikePrice);
    }

    // Fallback — резолвит без старта нового раунда (используется при ошибках)
    function resolveRound(uint256 _closingPrice, string calldata _proofHash) external onlyAgent nonReentrant {
        RoundInfo storage r = rounds[currentRoundId];
        require(!r.resolved, "Already resolved");
        require(block.timestamp >= r.endTime, "Not ended");

        r.resolved = true;
        r.closingPrice = _closingPrice;
        r.proofHash = _proofHash;

        bool upWon = _closingPrice > r.strikePrice;
        r.upWon = upWon;

        uint256 winnerPool   = upWon ? r.upPool   : r.downPool;
        uint256 loserPool    = upWon ? r.downPool  : r.upPool;
        uint256 winnerShares = upWon ? r.upShares  : r.downShares;

        uint256 fee = loserPool * 4 / 100;
        uint256 profitPool = loserPool - fee;

        if (winnerPool > 0 && winnerShares > 0) {
            Bet[] storage bets = _roundBets[currentRoundId];
            for (uint256 i = 0; i < bets.length; i++) {
                Bet memory b = bets[i];
                if (b.isUp == upWon) {
                    uint256 profit = (b.shares * profitPool) / winnerShares;
                    uint256 total = b.amount + profit;
                    if (b.fromVault && vault != address(0)) {
                        (bool success, ) = vault.call{value: total}(
                            abi.encodeWithSignature("creditWinnings(address)", b.player)
                        );
                        require(success, "Vault credit failed");
                    } else {
                        payable(b.player).transfer(total);
                    }
                    emit Payout(b.player, total);
                    playerStats[b.player].totalWins += 1;
                    playerStats[b.player].totalEarnings += total;
                }
            }
        } else {
            fee += profitPool;
        }

        accruedFees += fee;

        emit RoundResolved(currentRoundId, upWon, _closingPrice, r.upPool, r.downPool, r.totalPool);
    }

    // ── Views ──

    function getRoundInfo(uint256 _roundId) external view returns (RoundInfo memory) {
        return rounds[_roundId];
    }

    function getBets(uint256 _roundId) external view returns (Bet[] memory) {
        return _roundBets[_roundId];
    }

    function getCurrentRoundBets() external view returns (Bet[] memory) {
        return _roundBets[currentRoundId];
    }

    function getStrikePrice() external view returns (uint256) {
        return rounds[currentRoundId].strikePrice;
    }

    function roundEndTime() external view returns (uint256) {
        return rounds[currentRoundId].endTime;
    }

    function totalPool() external view returns (uint256) {
        return rounds[currentRoundId].totalPool;
    }

    function getUpPool() external view returns (uint256) {
        return rounds[currentRoundId].upPool;
    }

    function getDownPool() external view returns (uint256) {
        return rounds[currentRoundId].downPool;
    }

    function getLeaderboard() external view returns (PlayerStats[] memory) {
        uint256 len = allPlayers.length;
        PlayerStats[] memory res = new PlayerStats[](len);
        for (uint256 i = 0; i < len; i++) {
            res[i] = playerStats[allPlayers[i]];
        }
        return res;
    }
}
