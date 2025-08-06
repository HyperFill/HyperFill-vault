import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  const VaultFactory = await ethers.getContractFactory("HyperFillVault");
  const vault = await VaultFactory.deploy()
  await vault.waitForDeployment();
console.log(`Vault deployed at: ${await vault.getAddress()}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});


