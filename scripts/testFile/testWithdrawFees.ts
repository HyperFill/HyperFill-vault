import { ethers } from "hardhat";

async function main() {
    const VAULT_ADDRESS = "0xe47BcF7103bBc8d1DDD75f2Ab6813da050443D2c";

    const VAULT_ABI = [
        "function withdrawFees() external",
        "function getTotalAccumulatedFees() external view returns (uint256)",
        "function feeRecipient() external view returns (address)"
    ];

    const [signer] = await ethers.getSigners();
    console.log("🔑 Signer:", signer.address);

    const vault = await ethers.getContractAt(VAULT_ABI, VAULT_ADDRESS);

    try {
        // Vérifier le fee recipient
        const feeRecipient = await vault.feeRecipient();
        console.log("💰 Fee recipient:", feeRecipient);

        // Vérifier les fees accumulées
        const totalFees = await vault.getTotalAccumulatedFees();
        console.log("📊 Total fees accumulées:", ethers.utils.formatEther(totalFees), "SEI");

        if (totalFees === BigInt(0)) {
            console.log("⚠️  Aucune fee à retirer");
            return;
        }

        // Tenter de retirer les fees
        console.log("🔄 Tentative de retrait des fees...");
        const tx = await vault.withdrawFees();
        
        console.log("📤 Transaction envoyée:", tx.hash);
        console.log("⏳ Attente de confirmation...");
        
        const receipt = await tx.wait();
        console.log("✅ Transaction confirmée dans le bloc:", receipt.blockNumber);
        console.log("⛽ Gas utilisé:", receipt.gasUsed.toString());

        // Vérifier que les fees ont été retirées
        const remainingFees = await vault.getTotalAccumulatedFees();
        console.log("📊 Fees restantes:", ethers.utils.formatEther(remainingFees), "SEI");

        if (remainingFees === BigInt(0)) {
            console.log("🎉 Fees retirées avec succès!");
        } else {
            console.log("❌ Erreur: des fees restent dans le vault");
        }

    } catch (error: any) {
        console.error("❌ Erreur:", error.message);
        
        if (error.reason) {
            console.error("Raison:", error.reason);
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Script failed:", error);
        process.exit(1);
    });