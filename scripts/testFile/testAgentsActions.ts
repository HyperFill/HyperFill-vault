// scripts/testFile/testAgentToFro.ts
import { ethers } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

async function main() {
  // ========= CONFIG =========
  const WSEI_ADDRESS = "0x027D2E627209f1cebA52ADc8A5aFE9318459b44B"; // <-- change if needed
  const VAULT_ADDRESS = "0xe47BcF7103bBc8d1DDD75f2Ab6813da050443D2c"; // <-- change if needed

  // amounts
  const USER_DEPOSIT = ethers.utils.parseEther("1");     // user deposits 5 WSEI
  const MOVE_TO_AGENT = ethers.utils.parseEther("0.5");    // agent pulls 3 WSEI from vault
  const PROFIT_AMOUNT = ethers.utils.parseEther("0.1");    // set to >0 only if agent has extra WSEI to return
  const RUN_RETURN_ALL_CAPITAL = false;                  // set true to also test returnAllCapital

  // Optional: use a separate agent wallet
  // Provide AGENT_PK in .env if you want a different key from the user
  const AGENT_PK = process.env.AGENT_PK || ""; // must already be authorized in the vault

  // ========= ABIs =========
  const VAULT_ABI = [
    // state / views
    "function asset() external view returns (address)",
    "function paused() external view returns (bool)",
    "function minDeposit() external view returns (uint256)",
    "function totalAssets() external view returns (uint256)",
    "function totalSupply() external view returns (uint256)",
    "function getSharePrice() external view returns (uint256)",
    "function getAvailableAssets() external view returns (uint256)",
    "function totalAllocated() external view returns (uint256)",
    "function shareToUser(address) external view returns (uint256)",
    "function balanceOf(address) external view returns (uint256)",
    "function authorizedAgents(address) external view returns (bool)",
    "function maxAllocationBps() external view returns (uint256)",

    // erc4626 helpers
    "function previewDeposit(uint256 assets) external view returns (uint256 shares)",
    "function previewRedeem(uint256 shares) external view returns (uint256 assets)",

    // user flows
    "function depositLiquidity(uint256 assets) external returns (uint256 shares)",
    "function withdrawProfits() external returns (uint256 assets)",

    // agent flows
    "function moveFromVaultToWallet(uint256 amount, address tradingWallet) external",
    "function moveFromWalletToVault(uint256 amount, uint256 profitAmount, address fromWallet) external",
    "function returnAllCapital(address fromWallet) external",

    // admin (might fail if caller != owner)
    "function addAuthorizedAgent(address) external",
    "function setMinDeposit(uint256) external",
  ];

  const WSEI_ABI = [
    "function balanceOf(address) external view returns (uint256)",
    "function allowance(address owner, address spender) external view returns (uint256)",
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function decimals() external view returns (uint8)",
    "function symbol() external view returns (string)",
  ];

  // ========= SIGNERS / CONTRACTS =========
  const [user] = await ethers.getSigners();
  const provider = user.provider!;
  const vault = await ethers.getContractAt(VAULT_ABI, VAULT_ADDRESS);
  const wsei = await ethers.getContractAt(WSEI_ABI, WSEI_ADDRESS);

  // Agent signer: either same as user, or from AGENT_PK
  const agent =
    AGENT_PK && AGENT_PK.length > 0
      ? new ethers.Wallet(AGENT_PK, provider)
      : user;

  console.log("🏗  AGENT TO ↔ FRO FUNDS TEST");
  console.log("=".repeat(60));
  console.log(`User:  ${user.address}`);
  console.log(`Agent: ${agent.address}${agent.address === user.address ? " (same as user)" : ""}`);
  console.log(`Vault: ${VAULT_ADDRESS}`);
  console.log(`WSEI:  ${WSEI_ADDRESS}`);

  try {
    // 1) Basic checks
    console.log("\n1️⃣ Basic checks");
    const assetAddr = await vault.asset();
    console.log(`   Vault asset: ${assetAddr}`);
    if (assetAddr.toLowerCase() !== WSEI_ADDRESS.toLowerCase()) {
      console.log("❌ PROBLEM: Vault asset != configured WSEI address");
      return;
    }

    const isPaused = await vault.paused();
    console.log(`   Vault paused: ${isPaused}`);
    if (isPaused) {
      console.log("❌ PROBLEM: Vault is paused");
      return;
    }

    const minDep = await vault.minDeposit();
    console.log(`   Min deposit: ${ethers.utils.formatEther(minDep)} WSEI`);
    if (USER_DEPOSIT.lt(minDep)) {
      console.log("❌ PROBLEM: USER_DEPOSIT is below minDeposit");
      console.log("   Adjust USER_DEPOSIT or call setMinDeposit (owner only).");
      return;
    }

    // 2) User balances & vault info before
    console.log("\n2️⃣ Pre-deposit state");
    const userWseiBefore = await wsei.balanceOf(user.address);
    const totalAssetsBefore = await vault.totalAssets();
    const totalSupplyBefore = await vault.totalSupply();
    const sharePriceBefore = await vault.getSharePrice();
    console.log(`   User WSEI:        ${ethers.utils.formatEther(userWseiBefore)}`);
    console.log(`   Vault totalAssets ${ethers.utils.formatEther(totalAssetsBefore)}`);
    console.log(`   Vault totalSupply ${ethers.utils.formatEther(totalSupplyBefore)}`);
    console.log(`   Share price:      ${ethers.utils.formatEther(sharePriceBefore)}`);

    if (userWseiBefore.lt(USER_DEPOSIT)) {
      console.log("❌ PROBLEM: Not enough WSEI to deposit");
      return;
    }

    // 3) Deposit from user
    console.log("\n3️⃣ Deposit from user");
    const prevShares = await vault.previewDeposit(USER_DEPOSIT);
    console.log(`   previewDeposit(${ethers.utils.formatEther(USER_DEPOSIT)}): ${ethers.utils.formatEther(prevShares)} shares`);

    // approve & deposit
    const curAllowance = await wsei.allowance(user.address, VAULT_ADDRESS);
    if (curAllowance.lt(USER_DEPOSIT)) {
      console.log("   🔄 Approving WSEI to vault...");
      const aTx = await wsei.connect(user).approve(VAULT_ADDRESS, USER_DEPOSIT, { gasLimit: 100000 });
      await aTx.wait();
    }
    console.log("   🔄 Depositing...");
    const dTx = await vault.connect(user).depositLiquidity(USER_DEPOSIT, { gasLimit: 1_000_000 });
    console.log(`   TX: ${dTx.hash}`);
    const dRc = await dTx.wait();
    console.log(`   ✅ Deposit confirmed. Gas used: ${dRc.gasUsed.toString()}`);

    const userSharesAfterDep = await vault.balanceOf(user.address);
    const mappingSharesAfterDep = await vault.shareToUser(user.address);
    console.log(`   User shares (balanceOf): ${ethers.utils.formatEther(userSharesAfterDep)}`);
    console.log(`   User shares (mapping):   ${ethers.utils.formatEther(mappingSharesAfterDep)}`);

    // 4) Check/ensure agent authorization
    console.log("\n4️⃣ Agent authorization");
    let isAgent = await vault.authorizedAgents(agent.address);
    console.log(`   authorizedAgents[agent]: ${isAgent}`);
    if (!isAgent) {
      console.log("   ⚠️ Agent not authorized.");
      console.log("   Attempting addAuthorizedAgent(agent) — requires owner. This may revert if caller is not owner.");
      try {
        const addTx = await vault.connect(user).addAuthorizedAgent(agent.address);
        await addTx.wait();
        isAgent = await vault.authorizedAgents(agent.address);
        console.log(`   ✅ Now authorized: ${isAgent}`);
      } catch {
        console.log("   ❌ Could not authorize agent (caller not owner).");
        console.log("   👉 Make sure the AGENT address is already authorized by the owner before running this script.");
        return;
      }
    }

    // 5) Agent moves from vault → agent
    console.log("\n5️⃣ Agent move: Vault → Agent");
    const available = await vault.getAvailableAssets();
    const maxBps = await vault.maxAllocationBps();
    const maxAlloc = (await vault.totalAssets()).mul(maxBps).div(10_000);
    console.log(`   Available assets in vault: ${ethers.utils.formatEther(available)}`);
    console.log(`   Max allocation (bps=${maxBps}): ${ethers.utils.formatEther(maxAlloc)}`);

    if (MOVE_TO_AGENT.gt(available)) {
      console.log("❌ PROBLEM: MOVE_TO_AGENT > available assets");
      return;
    }
    if ((await vault.totalAllocated()).add(MOVE_TO_AGENT).gt(maxAlloc)) {
      console.log("❌ PROBLEM: Moving would exceed max allocation");
      return;
    }

    console.log("   🔄 Moving from vault to agent...");
    const mvOutTx = await vault
      .connect(agent)
      .moveFromVaultToWallet(MOVE_TO_AGENT, agent.address, { gasLimit: 1_000_000 });
    console.log(`   TX: ${mvOutTx.hash}`);
    await mvOutTx.wait();
    console.log("   ✅ Move out confirmed.");

    const agentBalAfterOut = await wsei.balanceOf(agent.address);
    const vaultBalAfterOut = await wsei.balanceOf(VAULT_ADDRESS);
    const totalAllocatedAfterOut = await vault.totalAllocated();
    console.log(`   Agent WSEI:       ${ethers.utils.formatEther(agentBalAfterOut)}`);
    console.log(`   Vault WSEI:       ${ethers.utils.formatEther(vaultBalAfterOut)}`);
    console.log(`   totalAllocated:   ${ethers.utils.formatEther(totalAllocatedAfterOut)}`);

    // 6) Agent returns funds: agent → vault
    console.log("\n6️⃣ Agent move: Agent → Vault");
    const amountBack = MOVE_TO_AGENT.add(PROFIT_AMOUNT);
    console.log(`   amount back:   ${ethers.utils.formatEther(amountBack)} (profit=${ethers.utils.formatEther(PROFIT_AMOUNT)})`);

    // Ensure agent has enough to return (profit must come from somewhere on testnet!)
    const agentBalNow = await wsei.balanceOf(agent.address);
    if (agentBalNow.lt(amountBack)) {
      console.log("⚠️ Agent does not have enough WSEI to include profit.");
      console.log("   Falling back to returning only the moved amount (profit=0).");
      // Adjust to zero profit path
      const onlyBack = MOVE_TO_AGENT;
      const alw = await wsei.allowance(agent.address, VAULT_ADDRESS);
      if (alw.lt(onlyBack)) {
        console.log("   🔄 Approving vault to spend agent funds...");
        const aTx2 = await wsei.connect(agent).approve(VAULT_ADDRESS, onlyBack);
        await aTx2.wait();
      }
      console.log("   🔄 Returning funds (no profit)...");
      const mvBackTx = await vault
        .connect(agent)
        .moveFromWalletToVault(onlyBack, ethers.constants.Zero, agent.address, { gasLimit: 1_000_000 });
      console.log(`   TX: ${mvBackTx.hash}`);
      await mvBackTx.wait();
    } else {
      // Profit path
      const alw2 = await wsei.allowance(agent.address, VAULT_ADDRESS);
      if (alw2.lt(amountBack)) {
        console.log("   🔄 Approving vault to spend agent funds...");
        const aTx3 = await wsei.connect(agent).approve(VAULT_ADDRESS, amountBack);
        await aTx3.wait();
      }
      console.log("   🔄 Returning funds (with profit)...");
      const mvBackTx2 = await vault
        .connect(agent)
        .moveFromWalletToVault(amountBack, PROFIT_AMOUNT, agent.address, { gasLimit: 1_000_000 });
      console.log(`   TX: ${mvBackTx2.hash}`);
      await mvBackTx2.wait();
    }
    console.log("   ✅ Return confirmed.");

    const totalAllocatedAfterBack = await vault.totalAllocated();
    const vaultWseiAfterBack = await wsei.balanceOf(VAULT_ADDRESS);
    const agentWseiAfterBack = await wsei.balanceOf(agent.address);
    console.log(`   totalAllocated: ${ethers.utils.formatEther(totalAllocatedAfterBack)}`);
    console.log(`   Vault WSEI:     ${ethers.utils.formatEther(vaultWseiAfterBack)}`);
    console.log(`   Agent WSEI:     ${ethers.utils.formatEther(agentWseiAfterBack)}`);

    // 7) (Optional) returnAllCapital
    if (RUN_RETURN_ALL_CAPITAL) {
      console.log("\n7️⃣ returnAllCapital (optional)");
      // Move out a small amount again
      const smallMove = ethers.utils.parseEther("0.5");
      console.log("   🔄 Moving small amount out...");
      const mvOut2 = await vault
        .connect(agent)
        .moveFromVaultToWallet(smallMove, agent.address, { gasLimit: 1_000_000 });
      await mvOut2.wait();

      // Approve vault to pull everything from agent
      const agentBalForReturnAll = await wsei.balanceOf(agent.address);
      const alw3 = await wsei.allowance(agent.address, VAULT_ADDRESS);
      if (alw3.lt(agentBalForReturnAll)) {
        console.log("   🔄 Approving vault for full agent balance...");
        const aTx4 = await wsei.connect(agent).approve(VAULT_ADDRESS, agentBalForReturnAll);
        await aTx4.wait();
      }

      console.log("   🔄 Calling returnAllCapital...");
      const racTx = await vault.connect(agent).returnAllCapital(agent.address, { gasLimit: 1_000_000 });
      console.log(`   TX: ${racTx.hash}`);
      await racTx.wait();
      console.log("   ✅ returnAllCapital confirmed.");

      const totalAllocatedAfterRAC = await vault.totalAllocated();
      console.log(`   totalAllocated: ${ethers.utils.formatEther(totalAllocatedAfterRAC)}`);
    }

    // 8) Summary
    console.log("\n🎯 SUMMARY");
    const endTotalAssets = await vault.totalAssets();
    const endTotalSupply = await vault.totalSupply();
    const endSharePrice = await vault.getSharePrice();
    const userSharesEnd = await vault.balanceOf(user.address);
    const userMappingEnd = await vault.shareToUser(user.address);

    console.log(`   Vault totalAssets: ${ethers.utils.formatEther(endTotalAssets)}`);
    console.log(`   Vault totalSupply: ${ethers.utils.formatEther(endTotalSupply)}`);
    console.log(`   Share price:       ${ethers.utils.formatEther(endSharePrice)}`);
    console.log(`   User shares (bal): ${ethers.utils.formatEther(userSharesEnd)}`);
    console.log(`   User shares (map): ${ethers.utils.formatEther(userMappingEnd)}`);

    console.log("\n✅ Agent to-and-fro movement complete.");
  } catch (error) {
    console.error("❌ Script error:");
    console.error("Message:", (error as Error).message);
    if ((error as any).reason) console.error("Reason:", (error as any).reason);
    if ((error as any).code) console.error("Code:", (error as any).code);

    console.log("\n💡 Troubleshooting:");
    console.log("- Ensure the vault’s asset matches WSEI_ADDRESS.");
    console.log("- Ensure the vault is not paused.");
    console.log("- Ensure USER_DEPOSIT >= minDeposit and user has enough WSEI.");
    console.log("- Ensure AGENT is authorized (owner must call addAuthorizedAgent).");
    console.log("- For profit path, ensure agent wallet actually holds extra WSEI.");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Script failed:", error);
    process.exit(1);
  });
