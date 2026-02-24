// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Predict402 {
    struct Bet {
        address player;
        bool isUp;
        uint256 amount;
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
    
    // Fee Logic
    uint256 public accruedFees; // Fees collected but not withdrawn
    uint256 public constant MIN_RESERVE = 0.01 ether; // Reserve for gas/ops

    // Reentrancy Guard
    uint256 private _status; // 1: NOT_ENTERED, 2: ENTERED

    mapping(uint256 => RoundInfo) public rounds;
    mapping(uint256 => Bet[]) public _roundBets;
    mapping(address => string) public nicknames;
    
    mapping(address => PlayerStats) public playerStats;
    address[] public allPlayers;

    event BetPlaced(address indexed player, uint256 indexed roundId, bool isUp, uint256 amount, string nickname, bool usedAi);
    event RoundStarted(uint256 indexed roundId, uint256 strikePrice, uint256 startTime, uint256 endTime);
    event RoundResolved(uint256 indexed roundId, bool upWon, uint256 closingPrice, uint256 upPool, uint256 downPool, uint256 totalPool);
    event Payout(address indexed player, uint256 amount);
    event FeesWithdrawn(address indexed owner, uint256 amount);
    event NicknameRegistered(address indexed player, string nickname);
    event AiPredictionStored(uint256 indexed roundId, address indexed player, uint256 predictedPrice, string proof, string direction);

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

    function withdrawFees(uint256 _amount) external onlyOwner nonReentrant {
        require(_amount <= accruedFees, "Amount exceeds fees");
        require(address(this).balance - _amount >= MIN_RESERVE, "Must keep reserve");
        
        accruedFees -= _amount;
        payable(owner).transfer(_amount);
        emit FeesWithdrawn(owner, _amount);
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
        require(rounds[currentRoundId].endTime > block.timestamp, "Round finished");
        
        string memory nick = nicknames[player];
        if (bytes(nick).length == 0) nick = "Player";

        Bet memory b = Bet(player, isUp, amount, nick, usedAi, fromVault);
        _roundBets[currentRoundId].push(b);

        RoundInfo storage r = rounds[currentRoundId];
        r.totalPool += amount;
        r.totalBets += 1;
        if (isUp) r.upPool += amount;
        else r.downPool += amount;

        playerStats[player].totalBets += 1;

        emit BetPlaced(player, currentRoundId, isUp, amount, nick, usedAi);
    }

    // ── Oracle / AI ──

    function storeAiPrediction(address _player, uint256 _price, string calldata _proof, string calldata _model, string calldata _dir) external onlyAgent {
         emit AiPredictionStored(currentRoundId, _player, _price, _proof, _dir);
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
        rounds[currentRoundId] = RoundInfo({
            startTime: block.timestamp,
            endTime: block.timestamp + roundDuration,
            strikePrice: _strikePrice,
            closingPrice: 0,
            upPool: 0,
            downPool: 0,
            totalPool: 0,
            totalBets: 0,
            resolved: false,
            upWon: false,
            proofHash: ""
        });
        emit RoundStarted(currentRoundId, _strikePrice, block.timestamp, block.timestamp + roundDuration);
    }

    function resolveRound(uint256 _closingPrice, string calldata _proofHash) external onlyAgent nonReentrant {
        RoundInfo storage r = rounds[currentRoundId];
        require(!r.resolved, "Already resolved");
        require(block.timestamp >= r.endTime, "Not ended");

        r.resolved = true;
        r.closingPrice = _closingPrice;
        r.proofHash = _proofHash;

        bool upWon = _closingPrice > r.strikePrice;
        r.upWon = upWon;

        uint256 winnerPool = upWon ? r.upPool : r.downPool;
        uint256 rewardPool = r.totalPool;

        // Fee 4% (Goes to accruedFees, remains in contract)
        uint256 fee = rewardPool * 4 / 100;
        accruedFees += fee;
        rewardPool -= fee;

        if (winnerPool > 0) {
            Bet[] storage bets = _roundBets[currentRoundId];
            for (uint256 i = 0; i < bets.length; i++) {
                Bet memory b = bets[i];
                if (b.isUp == upWon) {
                    // Proportional win
                    uint256 winnings = (b.amount * rewardPool) / winnerPool;
                    
                    if (b.fromVault && vault != address(0)) {
                        // Send to Vault via call (safe from reentrancy due to Guard)
                        (bool success, ) = vault.call{value: winnings}(
                            abi.encodeWithSignature("creditWinnings(address)", b.player)
                        );
                        require(success, "Vault credit failed");
                    } else {
                         payable(b.player).transfer(winnings);
                    }
                    
                    emit Payout(b.player, winnings);
                    playerStats[b.player].totalWins += 1;
                    playerStats[b.player].totalEarnings += winnings;
                }
            }
        } else {
            // No winners: House keeps reliable portion or carry over?
            // Simple: Add to accruedFees for Owner to withdraw later.
            accruedFees += rewardPool;
        }

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
        for(uint256 i=0; i<len; i++) {
            res[i] = playerStats[allPlayers[i]];
        }
        return res;
    }
    
    // Stub
    function distributeDevFee() external pure {} 
}
