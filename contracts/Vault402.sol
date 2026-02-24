// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IPredict402 {
    function placeBetFromVault(address _user, bool _isUp) external payable;
}

contract Vault402Binary {
    address public owner;
    address public predictContract;
    address public aiAgent;

    // Minimum balance to keep in contract for ops
    uint256 public constant MIN_RESERVE = 0.01 ether;

    mapping(address => uint256) public balances;
    mapping(address => bool) public autoBetEnabled;
    
    // Reentrancy Guard
    uint256 private _status;

    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event AutoBetToggled(address indexed user, bool enabled);
    event BetPlacedFor(address indexed user, bool isUp, uint256 amount, uint256 gasFee);
    event WinningsReceived(address indexed user, uint256 amount);
    event GasRefunded(address indexed agent, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier onlyAgent() {
        require(msg.sender == aiAgent || msg.sender == owner, "Not authorized");
        _;
    }

    modifier onlyPredict() {
        require(msg.sender == predictContract, "Not predict contract");
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

    function setPredictContract(address _predict) external onlyOwner {
        predictContract = _predict;
    }
    
    function setAiAgent(address _agent) external onlyOwner {
        aiAgent = _agent;
    }

    receive() external payable {
        deposit();
    }

    function deposit() public payable {
        require(msg.value > 0, "Zero deposit");
        balances[msg.sender] += msg.value;
        emit Deposited(msg.sender, msg.value);
    }

    function withdraw(uint256 amount) external nonReentrant {
        require(balances[msg.sender] >= amount, "Insufficient balance");
        // Ensure contract has enough liquidity (excluding reserve)
        require(address(this).balance - amount >= MIN_RESERVE, "Contract reserve hit");
        
        balances[msg.sender] -= amount;
        payable(msg.sender).transfer(amount);
        emit Withdrawn(msg.sender, amount);
    }
    
    function toggleAutoBet(bool enabled) external {
        autoBetEnabled[msg.sender] = enabled;
        emit AutoBetToggled(msg.sender, enabled);
    }

    /**
     * @notice Places individual bets for multiple users in a single transaction.
     * @dev Agent calls this. Loops through users and calls Predict contract for each.
     *      Calculates GAS COST per user and deducts from user balance to refund Agent.
     */
    function placeBetBatch(address[] calldata _users, uint256[] calldata _amounts, bool _isUp) external onlyAgent nonReentrant {
        require(_users.length == _amounts.length, "Length mismatch");
        require(predictContract != address(0), "Predict contract not set");
        
        uint256 totalRefund = 0;
        uint256 gasPrice = tx.gasprice;
        
        // Safety buffer: 100,000 gas per bet (~0.0001 ETH typically)
        // If user balance < amount + gasBuffer, skip.
        uint256 estimatedGasFee = 100000 * gasPrice; 

        for (uint256 i = 0; i < _users.length; i++) {
            uint256 startGas = gasleft();
            
            address user = _users[i];
            uint256 amount = _amounts[i];
            
            // Check if user has enough for Bet + Gas
            if (autoBetEnabled[user] && balances[user] >= amount + estimatedGasFee) {
                
                // 1. Deduct Bet Amount
                balances[user] -= amount;
                
                // 2. Call Bet
                bool success = false;
                try IPredict402(predictContract).placeBetFromVault{value: amount}(user, _isUp) {
                    success = true;
                } catch {}

                if (success) {
                    emit BetPlacedFor(user, _isUp, amount, 0); // Gas emitted later
                    
                    // 3. Calculate Actual Gas Used for this iteration
                    // (Start - End) + Allocation Overhead (~10k)
                    uint256 gasUsed = (startGas - gasleft()) + 10000;
                    uint256 actualFee = gasUsed * gasPrice;
                    
                    // Deduct Fee
                    if (balances[user] >= actualFee) {
                        balances[user] -= actualFee;
                        totalRefund += actualFee;
                    } else {
                        // Edge case: balance exactly amount + small buffer, but fee > buffer
                        // Take what's left
                        totalRefund += balances[user];
                        balances[user] = 0;
                    }
                } else {
                    // Revert balance deduction if failed
                    balances[user] += amount;
                }
            }
        }
        
        // Refund Agent for gas spent on successful bets
        if (totalRefund > 0) {
            payable(msg.sender).transfer(totalRefund);
            emit GasRefunded(msg.sender, totalRefund);
        }
    }

    // Called by Predict402 when player wins
    function creditWinnings(address user) external payable onlyPredict nonReentrant {
        balances[user] += msg.value;
        emit WinningsReceived(user, msg.value);
    }
    
    // View
    function getBalance(address user) external view returns (uint256) {
        return balances[user];
    }
    
    function canBet(address user, uint256 amount) external view returns (bool) {
        // Simple check, doesn't account for gas fee
        return balances[user] >= amount && autoBetEnabled[user];
    }
}
