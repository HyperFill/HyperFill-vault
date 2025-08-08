import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import dotenv from "dotenv";

dotenv.config();

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
    },
  },
  networks: {
    seiTestnet: {
      url: "wss://evm-ws-testnet.sei-apis.com",
      chainId: 1328,
      accounts: [process.env.PRIVATE_KEY!],
    },
    seiMainnet: {
      url: "https://evm-rpc.sei-apis.com",
      chainId: 1329,
      accounts: [process.env.PRIVATE_KEY!],
    },
  },
};

export default config;