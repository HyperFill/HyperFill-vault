import { ethers } from "hardhat";

async function main() {
    const VAULT_ADDRESS = "0x34d97ab8Faa4D2307F6762260328E36b2c9b86D8";
    const FEE_RECIPIENT_ADDRESS = "0xa7b84453a22AdAdC015CFd3ec5104e9C43BA6224";
    
    const VAULT_ABI = [
        "function setFeeRecipient(address newRecipient) external",
        "function feeRecipient() external view returns (address)",
        "function owner() external view returns (address)"
    ];

    const vault = await ethers.getContractAt(VAULT_ABI, VAULT_ADDRESS);

    try {
        // 1. Vérifier le fee recipient actuel
        console.log("📋 Vérification du fee recipient actuel...");
        const currentFeeRecipient = await vault.feeRecipient();
        console.log(`Fee recipient actuel: ${currentFeeRecipient}`);
        
        // 2. Vérifier le owner du contrat
        const owner = await vault.owner();
        console.log(`Owner du contrat: ${owner}`);
        
        // 3. Obtenir le signer actuel
        const [signer] = await ethers.getSigners();
        console.log(`Signer utilisé: ${signer.address}`);
        
        // 4. Vérifier que le signer est le owner
        if (owner.toLowerCase() !== signer.address.toLowerCase()) {
            throw new Error("❌ Le signer n'est pas le owner du contrat");
        }
        
        // 5. Si le fee recipient est déjà correct, pas besoin de changer
        if (currentFeeRecipient.toLowerCase() === FEE_RECIPIENT_ADDRESS.toLowerCase()) {
            console.log("✅ Le fee recipient est déjà configuré correctement");
            return;
        }
        
        // 6. Changer le fee recipient
        console.log("🔄 Changement du fee recipient...");
        const tx = await vault.setFeeRecipient(FEE_RECIPIENT_ADDRESS);
        
        console.log(`📤 Transaction envoyée: ${tx.hash}`);
        console.log("⏳ Attente de confirmation...");
        
        // 7. Attendre la confirmation
        const receipt = await tx.wait();
        
        console.log(`✅ Transaction confirmée dans le bloc: ${receipt.blockNumber}`);
        console.log(`⛽ Gas utilisé: ${receipt.gasUsed.toString()}`);
        
        // 8. Vérifier que le changement a été effectué
        const newFeeRecipient = await vault.feeRecipient();
        console.log(`✅ Nouveau fee recipient: ${newFeeRecipient}`);
        
        if (newFeeRecipient.toLowerCase() === FEE_RECIPIENT_ADDRESS.toLowerCase()) {
            console.log("🎉 Fee recipient changé avec succès!");
        } else {
            console.log("❌ Erreur: le fee recipient n'a pas été changé correctement");
        }
        
    } catch (error: any) {
        console.error("❌ Erreur:", error.message);
        
        // Afficher plus de détails si c'est une erreur de transaction
        if (error.transaction) {
            console.error("Transaction qui a échoué:", error.transaction);
        }
        if (error.receipt) {
            console.error("Receipt de la transaction:", error.receipt);
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Script failed:", error);
        process.exit(1);
    });