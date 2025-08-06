// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title HyperFillVault
 * @dev ERC4626 Vault for AI-powered market making on Sei
 * Users deposit SEI tokens and receive vault shares representing their portion of the pool
 */
contract HyperFillVault is ERC4626, Ownable, ReentrancyGuard, Pausable {
    
    // ===== EVENTS =====
    event LiquidityAdded(address indexed user, uint256 assets, uint256 shares);
    event LiquidityRemoved(address indexed user, uint256 assets, uint256 shares);
    event LiquidityMoved(address indexed user, address indexed tradingWallet, uint256 amount);
    event ProfitsReturned(address indexed user, address indexed fromWallet, uint256 amount);
    event SpecificAmountReturned(address indexed user, address indexed fromWallet, uint256 amount);
    event LiquidityReturned(address indexed user, address indexed fromWallet, uint256 amount);
    event AllCapitalReturned(address indexed user, address indexed fromWallet, uint256 amount);
    event ProfitsDeposited(uint256 amount);
    
    // ===== STATE VARIABLES =====
    
    /// @notice Mapping of authorized trading agents
    mapping(address => bool) public authorizedAgents;

    /// @notice Mapping of share's users
    mapping(address => uint256) public shareToUser;
    
    /// @notice Minimum deposit amount
    uint256 public minDeposit = 1e18; // 1 SEI minimum

    /// @notice Maximum allocation percentage (basis points, 10000 = 100%)
    uint256 public maxAllocationBps = 9000; // 90% max allocation

    /// @notice Total assets allocated to agents for trading
    uint256 public totalAllocated;

    /// @notice Array to keep track of all authorized agents (NOUVEAU - NÉCESSAIRE)
    address[] public authorizedAgentsList;
    
    // ===== CONSTRUCTOR =====
    
    /**
     * @dev Constructor
     * @param _asset The underlying asset (SEI token address)
     */
    constructor(
        IERC20 _asset
    ) 
        ERC4626(_asset) 
        ERC20("HyperFillVault Shares", "HPF")
        Ownable(msg.sender)
    {}
    
    // ===== LIQUIDITY FUNCTIONS =====
    
    /**
     * @notice Add liquidity to the vault
     * @param assets Amount of SEI tokens to deposit
     * @return shares Number of vault shares minted
     */
    function depositLiquidity(uint256 assets) 
        external 
        nonReentrant 
        whenNotPaused 
        returns (uint256 shares) 
    {
        require(assets >= minDeposit, "HyperFillVault: Below minimum deposit");
        require(assets > 0, "HyperFillVault: Cannot deposit zero");
        
        // Calculate shares to mint using ERC4626 logic
        shares = previewDeposit(assets);
        require(shares > 0, "HyperFillVault: Zero shares calculated");

        // Update shareToUser mapping
        shareToUser[msg.sender] = shares;
        
        // Transfer assets from user to vault
        IERC20(asset()).transferFrom(msg.sender, address(this), assets);
        
        // Mint shares to user
        _mint(msg.sender, shares);
        
        emit LiquidityAdded(msg.sender, assets, shares);
        
        return shares;
    }
    
    /**
     * @notice Remove liquidity from the vault
     * @param shares Number of shares to burn
     * @return assets Amount of SEI tokens returned
     */
    function withdrawProfits() 
        external 
        nonReentrant 
        whenNotPaused 
        returns (uint256 assets) 
    {
        uint256 shares = shareToUser[msg.sender];
        require(shares > 0, "HyperFillVault: Cannot redeem zero shares");
        require(balanceOf(msg.sender) >= shares, "HyperFillVault: Insufficient shares");

        // Calculate assets to return using ERC4626 logic
        assets = previewRedeem(shares);
        require(assets > 0, "HyperFillVault: Zero assets calculated");
        
        // Burn shares from user
        _burn(msg.sender, shares);
        
        // Transfer assets to user
        IERC20(asset()).transfer(msg.sender, assets);
        
        emit LiquidityRemoved(msg.sender, assets, shares);
        
        return assets;
    }

    
    // ===== AGENT MANAGEMENT =====

    /**
     * @notice Move liquidity from vault to agent trading wallet
     * @param amount Amount to transfer to agent
     * @param tradingWallet Destination wallet for trading
     */
    function moveFromVaultToWallet(
        uint256 amount, 
        address tradingWallet
    ) 
        external 
        nonReentrant 
        whenNotPaused 
    {
        require(authorizedAgents[msg.sender], "HyperFillVault: Agent not authorized");
        require(amount > 0, "HyperFillVault: Cannot move zero amount");
        require(tradingWallet != address(0), "HyperFillVault: Invalid trading wallet");
        
        // Check available liquidity (not already allocated)
        uint256 availableAssets = totalAssets() - totalAllocated;
        require(amount <= availableAssets, "HyperFillVault: Insufficient available liquidity");
        
        // Check allocation limits (80% max)
        uint256 newTotalAllocated = totalAllocated + amount;
        uint256 maxAllocation = (totalAssets() * maxAllocationBps) / 10000;
        require(newTotalAllocated <= maxAllocation, "HyperFillVault: Exceeds max allocation");
        
        // Update allocations
        totalAllocated += amount;
        
        // Transfer to trading wallet
        IERC20(asset()).transfer(tradingWallet, amount);
        
        emit LiquidityMoved(msg.sender, tradingWallet, amount);
    }

    /**
     * @notice Move profits from trading wallet back to vault
     * @param amount Amount to transfer back to vault
     * @param profitAmount Amount of profit (for tracking, rest is capital return)
     * @param fromWallet Source wallet address (where the profits are)
     */
    function moveFromWalletToVault(
        uint256 amount, 
        uint256 profitAmount,
        address fromWallet
    ) 
        external 
        nonReentrant 
        whenNotPaused 
    {
        require(authorizedAgents[msg.sender], "HyperFillVault: Agent not authorized");
        require(amount > 0, "HyperFillVault: Cannot move zero amount");
        require(fromWallet != address(0), "HyperFillVault: Invalid source wallet");

        uint256 capitalReturned = amount - profitAmount; 
        
        // Transfer tokens from wallet to vault
        // Note: fromWallet must have approved this contract to spend tokens
        IERC20(asset()).transferFrom(fromWallet, address(this), amount);

        // Update allocations (reduce by capital returned)
        totalAllocated -= capitalReturned;
        
        emit SpecificAmountReturned(msg.sender, fromWallet, amount);
    }
    
    /**
     * @notice Return all allocated capital back to vault (end trading session)
     * @param fromWallet Source wallet address
     */
    function returnAllCapital(address fromWallet) 
        external 
        nonReentrant 
        whenNotPaused 
    {
        require(authorizedAgents[msg.sender], "HyperFillVault: Agent not authorized");
        require(fromWallet != address(0), "HyperFillVault: Invalid source wallet");
        
        uint256 allocatedAmount = totalAllocated;
        
        // Check wallet balance
        uint256 walletBalance = IERC20(asset()).balanceOf(fromWallet);
        require(walletBalance >= allocatedAmount, "HyperFillVault: Insufficient balance in wallet");
        
        // Calculate profit/loss
        uint256 totalToReturn = walletBalance; // Return everything in wallet
        uint256 profitOrLoss = totalToReturn > allocatedAmount ? 
                              totalToReturn - allocatedAmount : 0;
        
        // Transfer all funds back
        IERC20(asset()).transferFrom(fromWallet, address(this), totalToReturn);
        
        // Reset agent allocation
        totalAllocated -= allocatedAmount;
        
        emit ProfitsReturned(msg.sender, fromWallet, profitOrLoss);
        emit LiquidityReturned(msg.sender, fromWallet, totalToReturn);
        emit AllCapitalReturned(msg.sender, fromWallet, totalToReturn);
        
        if (profitOrLoss > 0) {
            emit ProfitsDeposited(profitOrLoss);
        }
    }
    
    // ===== ADMIN FUNCTIONS =====
    
    /**
     * @notice Add authorized agent
     * @param agent Agent address to authorize
     */
    function addAuthorizedAgent(address agent) external onlyOwner {
        require(agent != address(0), "HyperFillVault: Invalid agent address");
        authorizedAgents[agent] = true;
        authorizedAgentsList.push(agent);
    }

    function removeAuthorizedAgent(address agent) external onlyOwner {
       
        uint256 index = type(uint256).max;
        for (uint256 i = 0; i < authorizedAgentsList.length; i++) {
            if (authorizedAgentsList[i] == agent) {
                index = i;
                break;
            }
        }
        
        require(index != type(uint256).max, "Not found");
        
        authorizedAgentsList[index] = authorizedAgentsList[authorizedAgentsList.length - 1];
        authorizedAgentsList.pop();
        authorizedAgents[agent] = false;
    }
    
    /**
     * @notice Set maximum allocation percentage
     * @param newMaxBps New maximum allocation in basis points
     */
    function setMaxAllocation(uint256 newMaxBps) external onlyOwner {
        require(newMaxBps <= 10000, "HyperFillVault: Cannot exceed 100%");
        maxAllocationBps = newMaxBps;
    }
    
    /**
     * @notice Set minimum deposit amount
     * @param newMinDeposit New minimum deposit amount
     */
    function setMinDeposit(uint256 newMinDeposit) external onlyOwner {
        minDeposit = newMinDeposit;
    }
    
    /**
     * @notice Emergency pause
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @notice Unpause
     */
    function unpause() external onlyOwner {
        _unpause();
    }
    
    // ===== VIEW FUNCTIONS =====
    
    /**
     * @notice Get available liquid assets (not allocated to agents)
     * @return Available assets amount
     */
    function getAvailableAssets() external view returns (uint256) {
        return totalAssets() - totalAllocated;
    }
    
    /**
     * @notice Calculate current share price
     * @return Price of 1 share in underlying assets (with 18 decimals)
     */
    function getSharePrice() external view returns (uint256) {
        if (totalSupply() == 0) return 1e18; // Initial price = 1:1
        return (totalAssets() * 1e18) / totalSupply();
    }
    
    /**
     * @notice Get all authorized agent addresses
     * @return Array of authorized agent addresses
     */
    function getAuthorizedAgents() external view returns (address[] memory) {
        return authorizedAgentsList;
    }

    /** 
     * @notice Get user's share of total assets
     * @param user User address
     * @return User's share in underlying assets
     */
     function getUserShareBalance(address user) external view returns (uint256) {
        return shareToUser[user];
    }
    /**
     * @notice Get balance of vault
     * @return Balance of vault
     */
    function getBalanceVault external view returns (uint256) {
        return balanceOf(address(this));
    }

    /**
     * @notice Get balance of user
     * @param user User address
     * @return Balance of user
     */
        function getBalanceUser(address user) external view returns (uint256) {
        return balanceOf(user);
    }
}