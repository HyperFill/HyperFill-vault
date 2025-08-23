// scripts/testFile/testWithdraw.ts
import { ethers } from "hardhat";

async function main() {
  // Config
  const VAULT_ADDRESS = "0xe47BcF7103bBc8d1DDD75f2Ab6813da050443D2c";
  const WSEI_ADDRESS = "0x027D2E627209f1cebA52ADc8A5aFE9318459b44B";
  
  // Get signer
  const [user] = await ethers.getSigners();
  
  // ABIs
  const VAULT_ABI = [
    "function withdrawProfits() external returns (uint256 assets)",
    "function getUserShareBalance(address user) external view returns (uint256)",
    "function getBalanceUser(address user) external view returns (uint256)",
    "function balanceOf(address account) external view returns (uint256)",
    "function totalSupply() external view returns (uint256)",
    "function totalAssets() external view returns (uint256)",
    "function getSharePrice() external view returns (uint256)",
    "function shareToUser(address user) external view returns (uint256)",
    "function previewRedeem(uint256 shares) external view returns (uint256)"
  ];
  
  const WSEI_ABI = [
    "function balanceOf(address account) external view returns (uint256)"
  ];
  
  const vault = await ethers.getContractAt(VAULT_ABI, VAULT_ADDRESS);
  const wsei = await ethers.getContractAt(WSEI_ABI, WSEI_ADDRESS);
  
  console.log("🏦 TEST WITHDRAW DU VAULT");
  console.log("=".repeat(50));
  console.log(`User: ${user.address}`);
  console.log(`Vault: ${VAULT_ADDRESS}`);
  console.log(`WSEI: ${WSEI_ADDRESS}`);
  
  try {
    // 1. Vérifier les balances AVANT withdraw
    console.log("\n1️⃣ Balances AVANT withdraw:");
    
    const userSharesMapping = await vault.shareToUser(user.address);
    const userSharesBalance = await vault.balanceOf(user.address);
    const userSharesFunction = await vault.getUserShareBalance(user.address);
    const wseiBalanceBefore = await wsei.balanceOf(user.address);
    const vaultTotalSupply = await vault.totalSupply();
    const vaultTotalAssets = await vault.totalAssets();
    const sharePrice = await vault.getSharePrice();
    
    console.log(`   User shares (mapping): ${ethers.utils.formatEther(userSharesMapping)}`);
    console.log(`   User shares (balanceOf): ${ethers.utils.formatEther(userSharesBalance)}`);
    console.log(`   User shares (function): ${ethers.utils.formatEther(userSharesFunction)}`);
    console.log(`   WSEI balance: ${ethers.utils.formatEther(wseiBalanceBefore)}`);
    console.log(`   Vault total supply: ${ethers.utils.formatEther(vaultTotalSupply)}`);
    console.log(`   Vault total assets: ${ethers.utils.formatEther(vaultTotalAssets)}`);
    console.log(`   Share price: ${ethers.utils.formatEther(sharePrice)}`);
    
    // Vérifier si l'utilisateur a des shares
    if (userSharesBalance.eq(0)) {
      console.log("❌ PROBLÈME: L'utilisateur n'a pas de shares à withdraw!");
      console.log("💡 SOLUTION: Fais d'abord un deposit avant de tester le withdraw");
      return;
    }
    
    // 2. Preview du withdraw
    console.log("\n2️⃣ Preview du withdraw:");
    try {
      const previewAssets = await vault.previewRedeem(userSharesBalance);
      console.log(`   Shares à withdraw: ${ethers.utils.formatEther(userSharesBalance)}`);
      console.log(`   Assets à recevoir: ${ethers.utils.formatEther(previewAssets)} WSEI`);
      
      if (previewAssets.eq(0)) {
        console.log("❌ PROBLÈME: previewRedeem retourne 0 assets!");
        console.log("Il y a un problème dans le calcul ERC4626");
        return;
      }
      
    } catch (error) {
      console.log("⚠️  Impossible de faire le preview:", (error as Error).message);
    }
    
    // 3. Exécuter le withdraw
    console.log("\n3️⃣ Exécution du withdraw:");
    console.log("🔄 Withdrawing all shares...");
    
    const withdrawTx = await vault.withdrawProfits({
      gasLimit: 500000 // Limite de gas élevée
    });
    
    console.log(`📤 Transaction envoyée: ${withdrawTx.hash}`);
    console.log("⏳ Attente de confirmation...");
    
    const receipt = await withdrawTx.wait();
    
    if (receipt.status === 1) {
      console.log("✅ Withdraw réussi!");
      console.log(`⛽ Gas utilisé: ${receipt.gasUsed}`);
      
      // Analyser les events
      if (receipt.logs && receipt.logs.length > 0) {
        console.log(`📋 Events émis: ${receipt.logs.length}`);
        // Tu peux décoder les events ici si nécessaire
      }
    } else {
      console.log("❌ Withdraw échoué!");
      return;
    }
    
    // 4. Vérifier les balances APRÈS withdraw
    console.log("\n4️⃣ Balances APRÈS withdraw:");
    
    const userSharesAfter = await vault.balanceOf(user.address);
    const userSharesMappingAfter = await vault.shareToUser(user.address);
    const wseiBalanceAfter = await wsei.balanceOf(user.address);
    const vaultTotalSupplyAfter = await vault.totalSupply();
    const vaultTotalAssetsAfter = await vault.totalAssets();
    
    console.log(`   User shares (balanceOf): ${ethers.utils.formatEther(userSharesAfter)}`);
    console.log(`   User shares (mapping): ${ethers.utils.formatEther(userSharesMappingAfter)}`);
    console.log(`   WSEI balance: ${ethers.utils.formatEther(wseiBalanceAfter)}`);
    console.log(`   Vault total supply: ${ethers.utils.formatEther(vaultTotalSupplyAfter)}`);
    console.log(`   Vault total assets: ${ethers.utils.formatEther(vaultTotalAssetsAfter)}`);
    
    // 5. Calculer les gains/pertes
    console.log("\n5️⃣ Résultats du withdraw:");
    
    const wseiReceived = wseiBalanceAfter.sub(wseiBalanceBefore);
    const sharesWithdrawn = userSharesBalance.sub(userSharesAfter);
    
    console.log(`   📈 WSEI reçu: ${ethers.utils.formatEther(wseiReceived)}`);
    console.log(`   📉 Shares brûlées: ${ethers.utils.formatEther(sharesWithdrawn)}`);
    
    // Vérifier la cohérence
    if (userSharesAfter.eq(0)) {
      console.log("✅ Toutes les shares ont été withdraw");
    } else {
      console.log(`⚠️  Il reste ${ethers.utils.formatEther(userSharesAfter)} shares`);
    }
    
    if (wseiReceived.gt(0)) {
      console.log("✅ WSEI récupéré avec succès");
      
      // Calculer le ratio de retour
      const returnRatio = wseiReceived.mul(1000).div(ethers.utils.parseEther("0.1")); // Basé sur le deposit de 0.1
      console.log(`   💰 Ratio de retour: ${returnRatio.toString()}/1000 (1000 = 100%)`);
      
      if (returnRatio.gte(1000)) {
        console.log("🎉 Tu as récupéré 100% ou plus de ton dépôt!");
      } else {
        console.log("📊 Tu as récupéré moins que ton dépôt initial");
      }
    } else {
      console.log("❌ Aucun WSEI récupéré - problème!");
    }
    
    console.log("\n🎯 WITHDRAW TERMINÉ!");
    console.log("✅ Fonction withdrawProfits() fonctionne correctement");
    
  } catch (error) {
    console.error("❌ Erreur lors du withdraw:");
    console.error("Error message:", (error as Error).message);
    
    // Analyse des erreurs courantes
    if ((error as Error).message.includes("Cannot redeem zero shares")) {
      console.log("💡 SOLUTION: L'utilisateur n'a pas de shares à withdraw");
    } else if ((error as Error).message.includes("Insufficient shares")) {
      console.log("💡 SOLUTION: Balance de shares insuffisant");
    } else if ((error as Error).message.includes("Zero assets calculated")) {
      console.log("💡 SOLUTION: Problème de calcul des assets dans ERC4626");
    } else if ((error as Error).message.includes("execution reverted")) {
      console.log("💡 SOLUTIONS POSSIBLES:");
      console.log("   - Vérifier que le vault a assez d'assets");
      console.log("   - Problème dans la logique de burn");
      console.log("   - Problème de transfer WSEI");
    }
    
    // Afficher plus de détails sur l'erreur
    if ((error as any).reason) {
      console.log("Reason:", (error as any).reason);
    }
    if ((error as any).code) {
      console.log("Code:", (error as any).code);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Script failed:", error);
    process.exit(1);
  });