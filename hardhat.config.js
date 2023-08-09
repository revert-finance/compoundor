require('dotenv').config()

require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-etherscan");
require("@nomiclabs/hardhat-ethers");
require('hardhat-contract-sizer');
require("hardhat-gas-reporter");

task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  mocha: {
    timeout: 100000000
  },
  solidity: {
    version: "0.7.6",
    settings: {
      optimizer: {
        enabled: true,
        runs: 1000000,
      },
    }
  },
  etherscan: {
    apiKey: {
      bsc: process.env.ETHERSCAN_API_KEY_BNB,
      base: process.env.ETHERSCAN_API_KEY_BASE
    },
    customChains: [
      {
        network: "base",
        chainId: 8453,
        urls: {
          apiURL: "https://basescan.org/api",
          browserURL: "https://basescan.org"
        }
      }
    ]
  },
  networks: {
    hardhat: {
      forking: {
        url: "https://eth-mainnet.alchemyapi.io/v2/" + process.env.ALCHEMY_KEY,
        blockNumber: 14667418 // 2022-04-27
      }
    },
    bnb: {
      url: "https://bsc-dataseed.binance.org",
      chainId: 56
    },
    evmos: {
      url: "https://evmos-evm.publicnode.com",
      chainId: 9001
    },
    base: {
      url: "https://mainnet.base.org",
      chainId: 8453
    }
  }
};
