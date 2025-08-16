// scripts/testFile/testDeposit.ts
import { ethers } from "hardhat";

async function main() {
  // Config
  const VAULT_ADDRESS = "0x2789213A4725FFF214DF9cA5B2fFe3b446f6A9e5";
  const WSEI_ADDRESS = "0x39210084A8AD511c8248761c8E35C8e525F0AdA";
  const DEPOSIT_AMOUNT = ethers.parseEther("1"); // 1 WSEI
  
  // Get signer
  const [user] = await ethers.getSigners();
  
  // ABIs
  const VAULT_ABI = [
    "function depositLiquidity(uint256 assets) external returns (uint256 shares)",
    "function getUserShareBalance(address user) external view returns (uint256)",
    "function getBalanceUser(address user) external view returns (uint256)",
    "function getBalanceVault() external view returns (uint256)"
  ];
  
  const WSEI_ABI = [
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function balanceOf(address account) external view returns (uint256)"
  ];
  
  // Create contracts using getContractFactory pour le vault
  const vault = await ethers.getContractAt(VAULT_ABI, VAULT_ADDRESS);
  
  // Create WSEI contract using getContractAt avec ABI minimal
  const wsei = await ethers.getContractAt(WSEI_ABI, WSEI_ADDRESS);
  
  console.log("👤 User:", user.address);
  console.log("🏦 Vault:", VAULT_ADDRESS);
  console.log("💰 Depositing:", ethers.formatEther(DEPOSIT_AMOUNT), "WSEI");
  console.log("=".repeat(50));
  
  try {
    // Check WSEI balance before
    console.log("💳 Checking WSEI balance...");
    const wseiBalanceBefore = await wsei.balanceOf(user.address);
    console.log("💳 WSEI balance before:", ethers.formatEther(wseiBalanceBefore));
    
    if (wseiBalanceBefore < DEPOSIT_AMOUNT) {
      console.log("❌ Insufficient WSEI balance!");
      return;
    }
    
    // Get balances before deposit
    console.log("\n📊 Balances BEFORE deposit:");
    const userSharesBefore = await vault.getUserShareBalance(user.address);
    const userBalanceBefore = await vault.getBalanceUser(user.address);
    const vaultBalanceBefore = await vault.getBalanceVault();
    
    console.log(`   User shares: ${ethers.formatEther(userSharesBefore)}`);
    console.log(`   User balance: ${ethers.formatEther(userBalanceBefore)}`);
    console.log(`   Vault balance: ${ethers.formatEther(vaultBalanceBefore)}`);
    
    // Step 1: Approve WSEI
    console.log("\n🔄 Step 1: Approving WSEI...");
    const approveTx = await wsei.approve(VAULT_ADDRESS, DEPOSIT_AMOUNT);
    await approveTx.wait();
    console.log("✅ WSEI approved!");
    
    // Step 2: Deposit
    console.log("\n🔄 Step 2: Depositing liquidity...");
    const depositTx = await vault.depositLiquidity(DEPOSIT_AMOUNT);
    console.log("📤 Transaction sent:", depositTx.hash);
    
    const receipt = await depositTx.wait();
    console.log("✅ Deposit successful!");
    console.log("⛽ Gas used:", receipt.gasUsed.toString());
    
    // Get balances after deposit
    console.log("\n📊 Balances AFTER deposit:");
    const userSharesAfter = await vault.getUserShareBalance(user.address);
    const userBalanceAfter = await vault.getBalanceUser(user.address);
    const vaultBalanceAfter = await vault.getBalanceVault();
    const wseiBalanceAfter = await wsei.balanceOf(user.address);
    
    console.log(`   User shares: ${ethers.formatEther(userSharesAfter)}`);
    console.log(`   User balance: ${ethers.formatEther(userBalanceAfter)}`);
    console.log(`   Vault balance: ${ethers.formatEther(vaultBalanceAfter)}`);
    console.log(`   WSEI balance: ${ethers.formatEther(wseiBalanceAfter)}`);
    
    // Calculate changes
    console.log("\n📈 Changes:");
    const sharesReceived = userSharesAfter - userSharesBefore;
    const balanceChange = userBalanceAfter - userBalanceBefore;
    const vaultChange = vaultBalanceAfter - vaultBalanceBefore;
    const wseiSpent = wseiBalanceBefore - wseiBalanceAfter;
    
    console.log(`   Shares received: ${ethers.formatEther(sharesReceived)}`);
    console.log(`   Balance change: ${ethers.formatEther(balanceChange)}`);
    console.log(`   Vault change: ${ethers.formatEther(vaultChange)}`);
    console.log(`   WSEI spent: ${ethers.formatEther(wseiSpent)}`);
    
    console.log("\n🎉 Test completed successfully!");
    
  } catch (error) {
    console.error("❌ Error during deposit:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Script failed:", error);
    process.exit(1);
  });