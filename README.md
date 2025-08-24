# HyperFill Vault Smart Contracts

```
██╗  ██╗██╗   ██╗██████╗ ███████╗██████╗ ███████╗██╗██╗     ██╗     
██║  ██║╚██╗ ██╔╝██╔══██╗██╔════╝██╔══██╗██╔════╝██║██║     ██║     
███████║ ╚████╔╝ ██████╔╝█████╗  ██████╔╝█████╗  ██║██║     ██║     
██╔══██║  ╚██╔╝  ██╔═══╝ ██╔══╝  ██╔══██╗██╔══╝  ██║██║     ██║     
██║  ██║   ██║   ██║     ███████╗██║  ██║██║     ██║███████╗███████╗
╚═╝  ╚═╝   ╚═╝   ╚═╝     ╚══════╝╚═╝  ╚═╝╚═╝     ╚═╝╚══════╝╚══════╝

          First AI Market Making Vault on SEI Network 
              "We make money while you sleep" - The HyperFill Team
```

> **ERC4626-compliant vault with integrated trade settlement system for AI-powered market making on SEI**

## Overview

HyperFill Vault is a core smart contract system deployed on SEI Network connected with autonomous financial agents. The system has two main contracts: a liquidity vault for user deposits and a trade settlement contract for multi party trading.

## Smart Contract Architecture

### HyperFillVault.sol
An ERC4626-compliant vault that manages user liquidity and AI agent capital allocation.

**Features:**
- **Liquidity**: Deposit/withdraw WSEI tokens
- **Share**: ERC4626 standard implementation
- **Agent Capital**: Secure fund movement to/from trading wallets
- **Fee**: Management and withdrawal fees with time-based calculations
- **Security**: ReentrancyGuard, Pausable and access controls

**Functions:**
```solidity
function depositLiquidity(uint256 assets) external returns (uint256 shares)
function withdrawProfits() external returns (uint256 assets)
function moveFromVaultToWallet(uint256 amount, address tradingWallet) external
function moveFromWalletToVault(uint256 amount, uint256 profitAmount, address fromWallet) external
```

### TradeSettlement.sol
A cryptographically secure multi-party trade settlement system.

**Features:**
- **Signature**: ECDSA signature validation for trade authorization
- **Management**: Replay attack prevention
- **Settlement**: Simultaneous asset exchange between parties
- **Balance**: Pre-execution balance and allowance checks

**Functions:**
```solidity
function settleTrade(TradeExecution tradeData, ...) external
function verifyTradeSignature(...) external pure returns (bool)
function batchCheckAllowances(...) external view returns (bool[], uint256[])
```

##  Technical Specifications

### HyperFillVault

**Inheritance:**
- `ERC4626` (OpenZeppelin) - Standard vault interface
- `Ownable` (OpenZeppelin) - Access control
- `ReentrancyGuard` (OpenZeppelin) - Reentrancy protection
- `Pausable` (OpenZeppelin) - Emergency controls

**State Variables:**
```solidity
mapping(address => bool) public authorizedAgents;
mapping(address => uint256) public shareToUser;
uint256 public minDeposit = 1e18; // 1 WSEI minimum
uint256 public maxAllocationBps = 9000; // 90% max allocation
uint256 public managementFeeBps = 200; // 2% annual
uint256 public withdrawalFeeBps = 10; // 0.1% on withdrawal
```

**Fee Structure:**
- **Management Fee**: 2% annually on AUM, calculated continuously
- **Withdrawal Fee**: 0.1% on withdrawal amount

### TradeSettlement

**Core Structures:**
```solidity
struct TradeExecution {
    uint256 orderId;
    address account;
    uint256 price;
    uint256 quantity;
    string side;
    address baseAsset;
    address quoteAsset;
    string tradeId;
    uint256 timestamp;
    bool isValid;
}
```

**Security Features:**
- ECDSA signature verification with EIP-191 message hashing
- Per-user, per-token nonce system
- Trade hash deduplication
- Pre-execution balance and allowance validation

## Deployment

### Prerequisites
```bash
npm install
```

### Environment Setup
Create `.env` file:
```env
PRIVATE_KEY=your_private_key_here
ASSET_ADDRESS=0x027D2E627209f1cebA52ADc8A5aFE9318459b44B
```

### Deploy to SEI Testnet
```bash
# Deploy HyperFillVault
npx hardhat run scripts/deploy.ts --network seiTestnet

# Deploy TradeSettlement
npx hardhat run scripts/deployTradeSettlement.ts --network seiTestnet
```

### Network Configuration
```javascript
// hardhat.config.ts
seiTestnet: {
  url: "https://evm-rpc-testnet.sei-apis.com",
  chainId: 1328,
  accounts: [process.env.PRIVATE_KEY],
  gasPrice: 20000000000,
}
```

## Testing

### Comprehensive Test Suite
```bash
# Run all tests
npx hardhat test

# Test vault deposit functionality
npx hardhat run scripts/testFile/testDeposit.ts --network seiTestnet

# Test vault withdrawal
npx hardhat run scripts/testFile/testWithdraw.ts --network seiTestnet

# Test trade settlement
npx hardhat run scripts/testFile/testSettlement.ts --network seiTestnet
```

### Test Coverage
-  Deposit/withdraw flows
-  Fee calculations
-  Agent capital allocation
-  Trade signature verification
-  Multi-party settlement
-  Error handling and edge cases

##  Contract Addresses (SEI Testnet)

```
HyperFillVault: 0xe47BcF7103bBc8d1DDD75f2Ab6813da050443D2c
TradeSettlement: 0xc2bE0BDc208034a6Db918e52F5763224479aD234
WSEI Token: 0x027D2E627209f1cebA52ADc8A5aFE9318459b44B
```

## Security

### Access
- **Owner-only functions**: Fee management, agent authorization, emergency controls
- **Agent-only functions**: Capital allocation and movement
- **User functions**: Deposit, withdraw with proper validation

### Measures
- **ReentrancyGuard**: Prevents reentrancy attacks
- **Pausable**: Emergency stop mechanism
- **Signature Verification**: Cryptographic trade authorization
- **Nonce System**: Prevents replay attacks
- **Balance Validation**: Pre-execution checks


##  Usage Examples

### Vault Operations
```javascript
// Deposit WSEI
const depositTx = await vault.depositLiquidity(ethers.parseEther("100"));

// Check user shares
const shares = await vault.getUserShareBalance(userAddress);

// Withdraw all shares
const withdrawTx = await vault.withdrawProfits();
```

### Agent Operations
```javascript
// Allocate capital to trading wallet
await vault.moveFromVaultToWallet(
    ethers.parseEther("50"),
    tradingWalletAddress
);

// Return capital with profits
await vault.moveFromWalletToVault(
    ethers.parseEther("55"), // total returned
    ethers.parseEther("5"),  // profit amount
    tradingWalletAddress
);
```

### Trade Settlement
```javascript
// Settle bilateral trade
await tradeSettlement.settleTrade(
    tradeData,
    party1Address,
    party2Address,
    party1Quantity,
    party2Quantity,
    "bid",
    "ask",
    signature1,
    signature2,
    nonce1,
    nonce2
);
```

##  License

MIT License - see [LICENSE](LICENSE) file for details.

---

**Built with ❤️ for the SEI ecosystem**
