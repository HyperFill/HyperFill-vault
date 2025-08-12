
import { ethers } from "hardhat";

async function main() {
  // Config
  const VAULT_ADDRESS = "0x2789213A4725FFF214DF9cA5B2fFe3b446f6A9e5";
  const AGENT_ADDRESS = "0xA548b3bbee2A5b779077234cc14b5c2CA3d95b85"; 
  // ABI minimal (juste les fonctions qu'on veut)
  const VAULT_ABI = [
    "function addAuthorizedAgent(address agent) external",
    "function authorizedAgents(address) external view returns (bool)",
    "function getAuthorizedAgents() external view returns (address[])"
  ];
  
  
  const vault = await ethers.getContractAt(VAULT_ABI, VAULT_ADDRESS);
  
  
  console.log("Adding agent:", AGENT_ADDRESS);
  const tx = await vault.addAuthorizedAgent(AGENT_ADDRESS);
  await tx.wait();
  
  console.log(" Agent added!");
  console.log("Transaction:", tx.hash);
  
  // Verify
  const isAuthorized = await vault.authorizedAgents(AGENT_ADDRESS);
  console.log("Authorized:", isAuthorized);
  
  
  const allAgents = await vault.getAuthorizedAgents();
  console.log("\n📋 All authorized agents:");
  for (let i = 0; i < allAgents.length; i++) {
    console.log(`  ${i + 1}. ${allAgents[i]}`);
  }
}

main().catch(console.error);





