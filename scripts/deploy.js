require('dotenv').config()

const hre = require("hardhat");

const nativeTokenAddresses = {
  "mainnet" : "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  "polygon" : "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270",
  "optimism" : "0x4200000000000000000000000000000000000006",
  "arbitrum" : "0x82af49447d8a07e3bd95bd0d56f35241523fbab1"
}

const factoryAddress = "0x1F98431c8aD98523631AE4a59f267346ea31F984"
const nonfungiblePositionManagerAddress = "0xC36442b4a4522E871399CD717aBDD847Ab11FE88"
const swapRouterAddress = "0xE592427A0AEce92De3Edee1F18E0157C05861564"

async function main() {

  const signer = new hre.ethers.Wallet(process.env.DEPLOYMENT_PRIVATE_KEY, hre.ethers.provider)

  console.log("Deploying on", hre.network.name)

  const nativeTokenAddress = nativeTokenAddresses[hre.network.name]

  const Contract = await hre.ethers.getContractFactory("Compoundor", signer);
  const contract = await Contract.deploy(nativeTokenAddress, factoryAddress, nonfungiblePositionManagerAddress, swapRouterAddress);
  await contract.deployed();

  await contract.transferOwnership(process.env.MULTISIG_ACCOUNT);

  console.log("Deployed at", contract.address)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
