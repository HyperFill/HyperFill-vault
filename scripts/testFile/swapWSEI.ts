import { ethers } from 'ethers';

// Testnet SEI
const RPC_URL = 'https://evm-rpc-testnet.sei-apis.com';
const WSEI_ADDRESS = '0x57eE725BEeB991c70c53f9642f36755EC6eb2139'; // WSEI testnet

const ABI = ['function deposit() payable'];

async function swapSeiToWsei() {
  // Configuration

  const amount = '1'; // Montant en SEI
  
  // Setup
  const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
  const contract = new ethers.Contract(WSEI_ADDRESS, ABI, wallet);
  
  try {
    console.log(`Swap ${amount} SEI → WSEI...`);
    
    const tx = await contract.deposit({
      value: ethers.utils.parseEther(amount)
    });
    
    console.log(`TX: ${tx.hash}`);
    await tx.wait();
    console.log('✅ Done!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

swapSeiToWsei();