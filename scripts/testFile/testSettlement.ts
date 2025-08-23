// scripts/testFile/testSettlement.ts
import { ethers } from "hardhat";
import { BigNumber } from "ethers";
import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

async function main() {
    console.log("🧪 Testing Deployed TradeSettlement Contract...");
    console.log("=".repeat(60));

    // ===== CONFIG =====
    const TRADE_SETTLEMENT_ADDRESS = "0xc2bE0BDc208034a6Db918e52F5763224479aD234"; // REMPLACEZ PAR VOTRE ADRESSE
    
    // ABIs
    const TRADE_SETTLEMENT_ABI = [
        "function owner() external view returns (address)",
        "function checkAllowance(address user, address token, uint256 requiredAmount) external view returns (bool sufficient, uint256 currentAllowance)",
        "function checkBalance(address user, address token, uint256 requiredAmount) external view returns (bool sufficient, uint256 currentBalance)",
        "function batchCheckAllowances(address[] memory users, address[] memory tokens, uint256[] memory amounts) external view returns (bool[] memory sufficient, uint256[] memory allowances)",
        "function verifyTradeSignature(address signer, uint256 orderId, address baseAsset, address quoteAsset, uint256 price, uint256 quantity, string memory side, uint256 timestamp, uint256 nonce, bytes memory signature) external pure returns (bool)",
        "function settleTrade((uint256 orderId, address account, uint256 price, uint256 quantity, string side, address baseAsset, address quoteAsset, string tradeId, uint256 timestamp, bool isValid) tradeData, address party1, address party2, uint256 party1Quantity, uint256 party2Quantity, string memory party1Side, string memory party2Side, bytes memory signature1, bytes memory signature2, uint256 nonce1, uint256 nonce2) external",
        "function getUserNonce(address user, address token) external view returns (uint256)",
        "event TradeSettled(address indexed party1, address indexed party2, address indexed baseAsset, address quoteAsset, uint256 price, uint256 quantity, uint256 timestamp)"
    ];

    const MOCK_ERC20_ABI = [
        "function balanceOf(address account) external view returns (uint256)",
        "function transfer(address to, uint256 amount) external returns (bool)",
        "function approve(address spender, uint256 amount) external returns (bool)",
        "function allowance(address owner, address spender) external view returns (uint256)",
        "function decimals() external view returns (uint8)",
        "function symbol() external view returns (string)",
        "function name() external view returns (string)"
    ];

    // Constants
    const INITIAL_SUPPLY = ethers.utils.parseEther("1000000");
    const TRADE_AMOUNT = ethers.utils.parseEther("100");
    const PRICE = ethers.utils.parseEther("1.5"); // 1.5 quote tokens per base token

    let tradeSettlement: any;
    let baseToken: any;
    let quoteToken: any;

    try {
        // Setup signers with better error handling
        console.log("🔧 Getting signers...");
        const signers = await ethers.getSigners();
        
        if (signers.length < 1) {
            throw new Error("No signers available. Check your wallet setup in hardhat.config.ts");
        }

        const owner = signers[0];
        console.log(`👤 Primary signer (Owner): ${owner.address}`);

        // Create additional signers for testing (if not available, use the same one)
        let trader1: SignerWithAddress;
        let trader2: SignerWithAddress;

        if (signers.length >= 3) {
            trader1 = signers[1];
            trader2 = signers[2];
            console.log(`👤 Trader1: ${trader1.address}`);
            console.log(`👤 Trader2: ${trader2.address}`);
        } else {
            // Use the same signer for all roles (for testing purposes)
            trader1 = owner;
            trader2 = owner;
            console.log(`⚠️  Using single signer for all roles: ${owner.address}`);
        }

        // Connect to deployed TradeSettlement
        console.log(`\n📋 Connecting to TradeSettlement at: ${TRADE_SETTLEMENT_ADDRESS}`);
        
        try {
            tradeSettlement = await ethers.getContractAt(TRADE_SETTLEMENT_ABI, TRADE_SETTLEMENT_ADDRESS);
            
            // Verify connection by calling owner()
            const contractOwner = await tradeSettlement.owner();
            console.log(`✅ Connected! Contract owner: ${contractOwner}`);
        } catch (contractError) {
            console.error("❌ Failed to connect to TradeSettlement contract:");
            console.error("- Check that the contract address is correct");
            console.error("- Verify the contract is deployed on seiTestnet");
            console.error("- Ensure the ABI matches the deployed contract");
            throw contractError;
        }

        // Deploy mock tokens for testing
        console.log("\n📋 Deploying mock ERC20 tokens for testing...");
        
        try {
            const MockERC20Factory = await ethers.getContractFactory("MockERC20");
            
            baseToken = await MockERC20Factory.deploy("Base Token", "BASE", INITIAL_SUPPLY);
            await baseToken.deployed();
            console.log(`✅ Base token deployed: ${baseToken.address}`);

            quoteToken = await MockERC20Factory.deploy("Quote Token", "QUOTE", INITIAL_SUPPLY);
            await quoteToken.deployed();
            console.log(`✅ Quote token deployed: ${quoteToken.address}`);
        } catch (tokenError) {
            console.error("❌ Failed to deploy mock tokens. Ensure MockERC20 contract exists:");
            throw tokenError;
        }

        // Setup trader balances and approvals
        console.log("\n💰 Setting up trader balances and approvals...");
        
        try {
            // Transfer tokens to traders (skip if using same signer)
            if (trader1.address !== owner.address) {
                await baseToken.transfer(trader1.address, ethers.utils.parseEther("10000"));
                await quoteToken.transfer(trader1.address, ethers.utils.parseEther("10000"));
            }
            
            if (trader2.address !== owner.address && trader2.address !== trader1.address) {
                await baseToken.transfer(trader2.address, ethers.utils.parseEther("10000"));
                await quoteToken.transfer(trader2.address, ethers.utils.parseEther("10000"));
            }

            // Approve TradeSettlement to spend tokens
            await baseToken.connect(trader1).approve(TRADE_SETTLEMENT_ADDRESS, ethers.constants.MaxUint256);
            await quoteToken.connect(trader1).approve(TRADE_SETTLEMENT_ADDRESS, ethers.constants.MaxUint256);
            
            if (trader2.address !== trader1.address) {
                await baseToken.connect(trader2).approve(TRADE_SETTLEMENT_ADDRESS, ethers.constants.MaxUint256);
                await quoteToken.connect(trader2).approve(TRADE_SETTLEMENT_ADDRESS, ethers.constants.MaxUint256);
            }
            
            console.log("✅ Balances and approvals set up");
        } catch (setupError) {
            console.error("❌ Failed to set up balances and approvals:");
            throw setupError;
        }

        // TEST 1: Basic Contract Interaction
        console.log("\n🧪 TEST 1: Basic Contract Functions");
        
        try {
            const [allowanceSufficient, allowanceAmount] = await tradeSettlement.checkAllowance(
                trader1.address,
                baseToken.address,
                TRADE_AMOUNT
            );
            
            console.log(`📊 Allowance check: sufficient=${allowanceSufficient}, amount=${ethers.utils.formatEther(allowanceAmount)}`);
            
            const [balanceSufficient, balanceAmount] = await tradeSettlement.checkBalance(
                trader1.address,
                baseToken.address,
                TRADE_AMOUNT
            );
            
            console.log(`📊 Balance check: sufficient=${balanceSufficient}, amount=${ethers.utils.formatEther(balanceAmount)}`);

            if (allowanceSufficient && balanceSufficient) {
                console.log("✅ Basic contract functions work correctly");
            } else {
                throw new Error("Allowance or balance check failed - check token setup");
            }
        } catch (testError) {
            console.error("❌ Basic function test failed:");
            throw testError;
        }

        // TEST 2: Signature Verification
        console.log("\n🧪 TEST 2: Signature Verification");
        
        try {
            const orderId = 1;
            const side = "bid";
            const timestamp = Math.floor(Date.now() / 1000);
            const nonce = 0;

            // Create message hash exactly like the contract
            const messageHash = ethers.utils.solidityKeccak256(
                ["uint256", "address", "address", "uint256", "uint256", "string", "uint256", "uint256"],
                [orderId, baseToken.address, quoteToken.address, PRICE, TRADE_AMOUNT, side, timestamp, nonce]
            );

            console.log(`📊 Message hash: ${messageHash}`);

            // Sign the message
            const signature = await trader1.signMessage(ethers.utils.arrayify(messageHash));
            console.log(`📊 Signature length: ${signature.length}`);

            const isValid = await tradeSettlement.verifyTradeSignature(
                trader1.address,
                orderId,
                baseToken.address,
                quoteToken.address,
                PRICE,
                TRADE_AMOUNT,
                side,
                timestamp,
                nonce,
                signature
            );

            console.log(`📊 Signature verification: ${isValid}`);

            if (isValid) {
                console.log("✅ Signature verification works correctly");
            } else {
                throw new Error("Signature verification failed");
            }
        } catch (sigError) {
            console.error("❌ Signature test failed:");
            throw sigError;
        }

        // TEST 3: Nonce Management
        console.log("\n🧪 TEST 3: Nonce Management");
        
        try {
            const initialNonce1 = await tradeSettlement.getUserNonce(trader1.address, baseToken.address);
            const initialNonce2 = await tradeSettlement.getUserNonce(trader2.address, baseToken.address);
            
            console.log(`📊 Initial nonces: Trader1=${initialNonce1}, Trader2=${initialNonce2}`);
            console.log("✅ Nonce management functions work");
        } catch (nonceError) {
            console.error("❌ Nonce test failed:");
            throw nonceError;
        }

        // For now, skip the full trade test if using single signer
        if (trader1.address === trader2.address) {
            console.log("\n⚠️  Skipping full trade test (single signer mode)");
            console.log("   To test full trades, configure multiple signers in hardhat.config.ts");
        } else {
            console.log("\n🧪 TEST 4: Full Trade Settlement");
            console.log("   (Implementation would go here with proper multi-signer setup)");
        }

        console.log("\n🎉 BASIC TESTS COMPLETED SUCCESSFULLY!");
        console.log("=".repeat(60));
        console.log("📊 Test Results Summary:");
        console.log("✅ Contract connection and communication");
        console.log("✅ Mock token deployment and setup");  
        console.log("✅ Basic contract function calls");
        console.log("✅ Cryptographic signature verification");
        console.log("✅ Nonce management");
        console.log(`\n🔗 TradeSettlement Address: ${TRADE_SETTLEMENT_ADDRESS}`);
        console.log(`🔗 Base Token Address: ${baseToken.address}`);
        console.log(`🔗 Quote Token Address: ${quoteToken.address}`);

    } catch (error: any) {
        console.error("\n❌ TEST FAILED:");
        console.error("Error message:", error.message);
        
        if (error.code) {
            console.error("Error code:", error.code);
        }
        
        if (error.transaction) {
            console.error("Failed transaction hash:", error.transaction.hash);
        }
        
        if (error.reason) {
            console.error("Revert reason:", error.reason);
        }

        console.log("\n🔧 Troubleshooting Tips:");
        console.log("1. Verify TradeSettlement contract address is correct");
        console.log("2. Ensure MockERC20 contract is available for deployment");
        console.log("3. Check that your wallet has sufficient SEI for gas");
        console.log("4. Verify network connection to seiTestnet");
        
        throw error;
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Script execution failed:", error);
        process.exit(1);
    });