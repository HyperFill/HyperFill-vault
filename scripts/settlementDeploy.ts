import { ethers } from "hardhat";
import hre from "hardhat";

async function main() {
    console.log("Deploying TradeSettlement contract...");

    // Get the deployer account
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with the account:", deployer.address);
    console.log("Account balance:", (await deployer.getBalance()).toString());

    // Deploy the contract
    const TradeSettlement = await ethers.getContractFactory("TradeSettlement");
    const tradeSettlement = await TradeSettlement.deploy();
    await tradeSettlement.deployed();

    console.log("TradeSettlement deployed to:", tradeSettlement.address);
    console.log("Deployment transaction hash:", tradeSettlement.deployTransaction.hash);

    // Verify the contract on Etherscan (if network supports it)
    if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
        console.log("Waiting for block confirmations...");
        await tradeSettlement.deployTransaction.wait(6);

        console.log("Verifying contract...");
        try {
            await hre.run("verify:verify", {
                address: tradeSettlement.address,
                constructorArguments: [],
            });
            console.log("Contract verified successfully");
        } catch (error) {
            if (error instanceof Error)
            console.log("Verification failed:", error.message);
            else
                console.log("Verification failed:")
        }
    }

    // Save deployment info
    const deploymentInfo = {
        network: hre.network.name,
        contract: "TradeSettlement",
        address: tradeSettlement.address,
        deployer: deployer.address,
        deploymentHash: tradeSettlement.deployTransaction.hash,
        timestamp: new Date().toISOString(),
    };

    console.log("\nDeployment Summary:");
    console.log(JSON.stringify(deploymentInfo, null, 2));

    return tradeSettlement;
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

export default main;