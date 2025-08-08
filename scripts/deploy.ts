import { ethers } from "hardhat";
import "dotenv/config";


async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  const VaultFactory = await ethers.getContractFactory("HyperFillVault");
  if (!process.env.ASSET_ADDRESS) {
    throw new Error("ASSET_ADDRESS env var is required");
  }
  const vault = await VaultFactory.deploy(process.env.ASSET_ADDRESS!);
  await vault.waitForDeployment();
console.log(`Vault deployed at: ${await vault.getAddress()}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});


