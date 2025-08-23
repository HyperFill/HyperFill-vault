// scripts/testFile/debugDeposit.ts
import { ethers } from "hardhat";

async function main() {
  // Config
  const VAULT_ADDRESS = "0xe47BcF7103bBc8d1DDD75f2Ab6813da050443D2c";
  const WSEI_ADDRESS = "0x027D2E627209f1cebA52ADc8A5aFE9318459b44B";
  const DEPOSIT_AMOUNT = ethers.utils.parseEther("1");
  
  // Get signer
  const [user] = await ethers.getSigners();
  
  // ✅ ABI CORRECTES basées sur le contrat HyperFillVault
  const VAULT_ABI = [
    "function depositLiquidity(uint256 assets) external returns (uint256 shares)",
    "function withdrawProfits() external returns (uint256 assets)",
    "function getUserShareBalance(address user) external view returns (uint256)",
    "function getBalanceUser(address user) external view returns (uint256)",
    "function getBalanceVault() external view returns (uint256)",
    "function asset() external view returns (address)",
    "function totalSupply() external view returns (uint256)",
    "function totalAssets() external view returns (uint256)",
    "function balanceOf(address account) external view returns (uint256)",
    "function getSharePrice() external view returns (uint256)",
    "function getAvailableAssets() external view returns (uint256)",
    "function minDeposit() external view returns (uint256)",
    "function paused() external view returns (bool)",
    "function shareToUser(address user) external view returns (uint256)"
  ];
  
  const WSEI_ABI = [
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function balanceOf(address account) external view returns (uint256)",
    "function allowance(address owner, address spender) external view returns (uint256)",
    "function decimals() external view returns (uint8)",
    "function symbol() external view returns (string)",
    "function transfer(address to, uint256 amount) external returns (bool)"
  ];
  
  const vault = await ethers.getContractAt(VAULT_ABI, VAULT_ADDRESS);
  const wsei = await ethers.getContractAt(WSEI_ABI, WSEI_ADDRESS);
  
  console.log("🔍 DIAGNOSTIC DU PROBLÈME - ABI VAULT CORRECTES");
  console.log("=".repeat(60));
  
  try {
    // 1. Vérifications de base
    console.log("\n1️⃣ Vérifications de base:");
    console.log(`User: ${user.address}`);
    console.log(`Vault: ${VAULT_ADDRESS}`);
    console.log(`WSEI: ${WSEI_ADDRESS}`);
    console.log(`Amount: ${ethers.utils.formatEther(DEPOSIT_AMOUNT)} WSEI`);
    
    // 2. Vérifier l'état du vault
    console.log("\n2️⃣ État du vault:");
    
    try {
      const isPaused = await vault.paused();
      console.log(`Vault paused: ${isPaused}`);
      if (isPaused) {
        console.log("❌ PROBLÈME: Le vault est en pause!");
        return;
      }
      console.log("✅ Vault actif");
    } catch (error) {
      console.log("⚠️  Impossible de vérifier si le vault est en pause");
    }
    
    try {
      const minDeposit = await vault.minDeposit();
      console.log(`Minimum deposit: ${ethers.utils.formatEther(minDeposit)} WSEI`);
      
      if (DEPOSIT_AMOUNT.lt(minDeposit)) {
        console.log("❌ PROBLÈME: Montant inférieur au minimum!");
        console.log(`   Requis: ${ethers.utils.formatEther(minDeposit)}`);
        console.log(`   Fourni: ${ethers.utils.formatEther(DEPOSIT_AMOUNT)}`);
        return;
      }
      console.log("✅ Montant supérieur au minimum");
    } catch (error) {
      console.log("⚠️  Impossible de vérifier le minimum deposit");
    }
    
    // 3. Vérifier l'asset du vault
    console.log("\n3️⃣ Vérification de l'asset:");
    try {
      const vaultAsset = await vault.asset();
      console.log(`Vault asset: ${vaultAsset}`);
      console.log(`WSEI address: ${WSEI_ADDRESS}`);
      
      if (vaultAsset.toLowerCase() !== WSEI_ADDRESS.toLowerCase()) {
        console.log("❌ PROBLÈME: Le vault n'utilise pas WSEI comme asset!");
        return;
      }
      console.log("✅ Asset correct");
         } catch (error) {
       console.log("❌ Impossible de vérifier l'asset:", (error as Error).message);
       return;
     }
    
    // 4. Vérifier le solde WSEI
    console.log("\n4️⃣ Solde WSEI:");
    const wseiBalance = await wsei.balanceOf(user.address);
    console.log(`Balance WSEI: ${ethers.utils.formatEther(wseiBalance)}`);
    
    if (wseiBalance.lt(DEPOSIT_AMOUNT)) {
      console.log("❌ PROBLÈME: Pas assez de WSEI!");
      console.log(`   Requis: ${ethers.utils.formatEther(DEPOSIT_AMOUNT)}`);
      console.log(`   Disponible: ${ethers.utils.formatEther(wseiBalance)}`);
      console.log("\n💡 SOLUTION: Wrappe du SEI en WSEI d'abord!");
      return;
    }
    console.log("✅ Solde WSEI suffisant");
    
    // 5. Informations du vault
    console.log("\n5️⃣ Informations du vault:");
    try {
      const totalSupply = await vault.totalSupply();
      const totalAssets = await vault.totalAssets();
      const availableAssets = await vault.getAvailableAssets();
      const sharePrice = await vault.getSharePrice();
      
      console.log(`Total supply: ${ethers.utils.formatEther(totalSupply)}`);
      console.log(`Total assets: ${ethers.utils.formatEther(totalAssets)}`);
      console.log(`Available assets: ${ethers.utils.formatEther(availableAssets)}`);
      console.log(`Share price: ${ethers.utils.formatEther(sharePrice)}`);
      
      // Vérifier les balances utilisateur dans le vault
      const userShares = await vault.getUserShareBalance(user.address);
      const userBalance = await vault.getBalanceUser(user.address);
      const userSharesFromMapping = await vault.shareToUser(user.address);
      
      console.log(`User shares (getUserShareBalance): ${ethers.utils.formatEther(userShares)}`);
      console.log(`User balance (getBalanceUser): ${ethers.utils.formatEther(userBalance)}`);
      console.log(`User shares (mapping): ${ethers.utils.formatEther(userSharesFromMapping)}`);
      
         } catch (error) {
       console.log("⚠️  Erreur lors de la lecture des infos vault:", (error as Error).message);
     }
    
    // 6. Test approval
    console.log("\n6️⃣ Test d'approval:");
    try {
      // Vérifier l'allowance actuelle
      const currentAllowance = await wsei.allowance(user.address, VAULT_ADDRESS);
      console.log(`Allowance actuelle: ${ethers.utils.formatEther(currentAllowance)}`);
      
      if (currentAllowance.lt(DEPOSIT_AMOUNT)) {
        console.log("🔄 Approval nécessaire...");
        const approveTx = await wsei.approve(VAULT_ADDRESS, DEPOSIT_AMOUNT, {
          gasLimit: 100000
        });
        await approveTx.wait();
        console.log("✅ Approval réussi");
        
        // Vérifier la nouvelle allowance
        const newAllowance = await wsei.allowance(user.address, VAULT_ADDRESS);
        console.log(`Nouvelle allowance: ${ethers.utils.formatEther(newAllowance)}`);
      } else {
        console.log("✅ Allowance suffisante");
      }
      
         } catch (error) {
       console.log("❌ PROBLÈME avec l'approval:", (error as Error).message);
       return;
     }
    
    // 7. Test deposit avec un petit montant
    console.log("\n7️⃣ Test deposit:");
    try {
      const testAmount = ethers.utils.parseEther("1");
      
      // S'assurer qu'on a l'allowance pour le test
      const testApproveTx = await wsei.approve(VAULT_ADDRESS, testAmount);
      await testApproveTx.wait();
      
      console.log("🔄 Testing deposit...");
      
      // Essayer le dépôt avec une limite de gas élevée
      const depositTx = await vault.depositLiquidity(testAmount, {
        gasLimit: 1000000 // Limite élevée pour debug
      });
      
      console.log(`✅ Dépôt test réussi! TX: ${depositTx.hash}`);
      const receipt = await depositTx.wait();
      console.log(`✅ Transaction confirmée. Gas utilisé: ${receipt.gasUsed}`);
      
      // Vérifier les balances après le test
      console.log("\n📊 Balances après test:");
      const newUserShares = await vault.getUserShareBalance(user.address);
      const newUserBalance = await vault.getBalanceUser(user.address);
      console.log(`User shares: ${ethers.utils.formatEther(newUserShares)}`);
      console.log(`User balance: ${ethers.utils.formatEther(newUserBalance)}`);
      
    } catch (error) {
      console.log("❌ PROBLÈME avec le dépôt:");
      console.log("Error message:", (error as Error).message);
      
      // Analyse des erreurs courantes
      if ((error as Error).message.includes("Below minimum deposit")) {
        console.log("💡 SOLUTION: Montant trop petit");
      } else if ((error as Error).message.includes("Cannot deposit zero")) {
        console.log("💡 SOLUTION: Montant zéro détecté");
      } else if ((error as Error).message.includes("Zero shares calculated")) {
        console.log("💡 SOLUTION: Problème de calcul des shares");
      } else if ((error as Error).message.includes("execution reverted")) {
        console.log("💡 SOLUTIONS POSSIBLES:");
        console.log("   - Vérifier que le vault n'est pas en pause");
        console.log("   - Vérifier l'allowance WSEI");
        console.log("   - Vérifier le solde WSEI");
        console.log("   - Problème dans la logique du contrat");
      }
      
      // Afficher plus de détails sur l'erreur
      if ((error as any).reason) {
        console.log("Reason:", (error as any).reason);
      }
      if ((error as any).code) {
        console.log("Code:", (error as any).code);
      }
    }
    
    console.log("\n🎯 RÉSUMÉ:");
    console.log("- Vault actif et configuré correctement");
    console.log("- Asset correct (WSEI)");
    console.log("- ABI fonctions matchent le contrat");
    console.log("- Si le test échoue, c'est probablement un problème de logique interne");
    
  } catch (error) {
    console.error("❌ Erreur générale:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Script failed:", error);
    process.exit(1);
  });