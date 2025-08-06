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
      url: process.env.SEI_TESTNET_URL!,
      chainId: 1328,
      accounts: [process.env.PRIVATE_KEY!],
    },
    seiMainnet: {
      url: process.env.SEI_MAINNET_URL!,
      chainId: 1329,
      accounts: [process.env.PRIVATE_KEY!],
    },
  },
};

export default config;