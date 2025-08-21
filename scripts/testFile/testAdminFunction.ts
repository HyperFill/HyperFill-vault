import { ethers } from "hardhat";

async function main() {
    // Config
    const VAULT_ADDRESS = "0x34d97ab8Faa4D2307F6762260328E36b2c9b86D8";
    const NEW_MAX_ALLOCATION_BPS = 9000; // 90% (10000 basis points)
    const NEW_MIN_DEPOSIT = ethers.utils.parseEther("1"); // 1 SEI minimum

    const VAULT_ABI = [
        "function setMaxAllocation(uint256 newMaxBps) external",
        "function setMinDeposit(uint256 newMinDeposit) external",
        "function maxAllocationBps() external view returns (uint256)",
        "function minDeposit() external view returns (uint256)",
        "function owner() external view returns (address)"
    ];

    // Get signer
    const [user] = await ethers.getSigners();
    console.log("🔑 User:", user.address);

    const vault = await ethers.getContractAt(VAULT_ABI, VAULT_ADDRESS);

    try {
        // 1. Vérifier le owner du contrat
        console.log("📋 Vérification des permissions...");
        const owner = await vault.owner();
        console.log(`Owner du contrat: ${owner}`);
        
        if (owner.toLowerCase() !== user.address.toLowerCase()) {
            throw new Error("❌ L'utilisateur n'est pas le owner du contrat");
        }

        // 2. Vérifier les valeurs actuelles
        console.log("\n📊 Valeurs actuelles:");
        const currentMaxAllocation = await vault.maxAllocationBps();
        const currentMinDeposit = await vault.minDeposit();
        
        console.log(`Max allocation actuelle: ${currentMaxAllocation} BPS (${Number(currentMaxAllocation) / 100}%)`);
        console.log(`Min deposit actuel: ${ethers.utils.formatEther(currentMinDeposit)} SEI`);

        // 3. Mettre à jour Max Allocation
        console.log("\n🔄 Mise à jour de Max Allocation...");
        if (currentMaxAllocation.toString() !== NEW_MAX_ALLOCATION_BPS.toString()) {
            const maxAllocTx = await vault.setMaxAllocation(NEW_MAX_ALLOCATION_BPS);
            console.log(`📤 Transaction Max Allocation envoyée: ${maxAllocTx.hash}`);
            
            const maxAllocReceipt = await maxAllocTx.wait();
            console.log(`✅ Max Allocation confirmée dans le bloc: ${maxAllocReceipt.blockNumber}`);
            console.log(`⛽ Gas utilisé: ${maxAllocReceipt.gasUsed.toString()}`);
        } else {
            console.log("✅ Max Allocation déjà configurée correctement");
        }

        // 4. Mettre à jour Min Deposit
        console.log("\n🔄 Mise à jour de Min Deposit...");
        if (currentMinDeposit.toString() !== NEW_MIN_DEPOSIT.toString()) {
            const minDepositTx = await vault.setMinDeposit(NEW_MIN_DEPOSIT);
            console.log(`📤 Transaction Min Deposit envoyée: ${minDepositTx.hash}`);
            
            const minDepositReceipt = await minDepositTx.wait();
            console.log(`✅ Min Deposit confirmé dans le bloc: ${minDepositReceipt.blockNumber}`);
            console.log(`⛽ Gas utilisé: ${minDepositReceipt.gasUsed.toString()}`);
        } else {
            console.log("✅ Min Deposit déjà configuré correctement");
        }

        // 5. Vérifier les nouvelles valeurs
        console.log("\n🔍 Vérification des nouvelles valeurs:");
        const newMaxAllocation = await vault.maxAllocationBps();
        const newMinDeposit = await vault.minDeposit();
        
        console.log(`Nouvelle Max allocation: ${newMaxAllocation} BPS (${Number(newMaxAllocation) / 100}%)`);
        console.log(`Nouveau Min deposit: ${ethers.utils.formatEther(newMinDeposit)} SEI`);

        // 6. Validation finale
        const maxAllocSuccess = newMaxAllocation.toString() === NEW_MAX_ALLOCATION_BPS.toString();
        const minDepositSuccess = newMinDeposit.toString() === NEW_MIN_DEPOSIT.toString();

        if (maxAllocSuccess && minDepositSuccess) {
            console.log("\n🎉 Configuration du vault mise à jour avec succès!");
        } else {
            console.log("\n❌ Erreur: certaines valeurs n'ont pas été mises à jour correctement");
            if (!maxAllocSuccess) console.log("❌ Max Allocation incorrecte");
            if (!minDepositSuccess) console.log("❌ Min Deposit incorrect");
        }

    } catch (error: any) {
        console.error("\n❌ Erreur:", error.message);
        
        // Afficher plus de détails si c'est une erreur de transaction
        if (error.transaction) {
            console.error("Transaction qui a échoué:", error.transaction);
        }
        if (error.receipt) {
            console.error("Receipt de la transaction:", error.receipt);
        }
        if (error.reason) {
            console.error("Raison de l'échec:", error.reason);
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Script failed:", error);
        process.exit(1);
    });