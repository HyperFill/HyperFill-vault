import { ethers } from "hardhat";

async function main() {
  // Config
  const VAULT_ADDRESS = "0x1a04F101aA4e155fCFe6EC49681C6AE9212B40F8";

  const VAULT_ABI = [
    "function setMaxAllocation(uint256 newMaxBps) external",
    "function setMinDeposit(uint256 newMinDeposit) external"
  ];
  
  // Get signer
  const [user] = await ethers.getSigners();

  console.log("User:", user.address);

  const vault = await ethers.getContractAt(VAULT_ABI, VAULT_ADDRESS);

  const maxAllocationBps = await vault.setMaxAllocation(10000);
  console.log("Max allocation BPS:", maxAllocationBps);

  const minDeposit = await vault.setMinDeposit(10000);
  console.log("Min deposit:", minDeposit);
  
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});