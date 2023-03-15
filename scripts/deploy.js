require('dotenv').config()

const hre = require("hardhat");

const nativeTokenAddresses = {
  "mainnet" : "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  "polygon" : "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270",
  "optimism" : "0x4200000000000000000000000000000000000006",
  "arbitrum" : "0x82af49447d8a07e3bd95bd0d56f35241523fbab1",
  "bnb" : "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c"
}

const factoryAddress = "0xdb1d10011ad0ff90774d0c6bb92e5c5c8b4461f7"
const nonfungiblePositionManagerAddress = "0x7b8a01b39d58278b5de7e48c8449c9f4f5170613"
const swapRouterAddress = "0xb971ef87ede563556b2ed4b1c0b0019111dd85d2"

async function main() {

  // set manually for each network
  const gasPrice = 5000000000
  const gasLimit = 6000000

  const signer = new hre.ethers.Wallet(process.env.DEPLOYMENT_PRIVATE_KEY, hre.ethers.provider)

  console.log("Deploying on", hre.network.name)

  const nativeTokenAddress = nativeTokenAddresses[hre.network.name]

  const Contract = await hre.ethers.getContractFactory("Compoundor", signer);
  
  const contract = await Contract.deploy(nativeTokenAddress, factoryAddress, nonfungiblePositionManagerAddress, swapRouterAddress, { gasPrice, gasLimit });
  await contract.deployed();

  //await contract.transferOwnership(process.env.MULTISIG_ACCOUNT);

  console.log("Deployed at", contract.address)
}

// npx hardhat verify --network mainnet "" "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" "0x1F98431c8aD98523631AE4a59f267346ea31F984" "0xC36442b4a4522E871399CD717aBDD847Ab11FE88" "0xE592427A0AEce92De3Edee1F18E0157C05861564"
// npx hardhat verify --network polygon "" "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270" "0x1F98431c8aD98523631AE4a59f267346ea31F984" "0xC36442b4a4522E871399CD717aBDD847Ab11FE88" "0xE592427A0AEce92De3Edee1F18E0157C05861564"
// npx hardhat verify --network optimism "" "0x4200000000000000000000000000000000000006" "0x1F98431c8aD98523631AE4a59f267346ea31F984" "0xC36442b4a4522E871399CD717aBDD847Ab11FE88" "0xE592427A0AEce92De3Edee1F18E0157C05861564"
// npx hardhat verify --network arbitrum "" "0x82af49447d8a07e3bd95bd0d56f35241523fbab1" "0x1F98431c8aD98523631AE4a59f267346ea31F984" "0xC36442b4a4522E871399CD717aBDD847Ab11FE88" "0xE592427A0AEce92De3Edee1F18E0157C05861564"
// npx hardhat verify --network bnb "" "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c" "0xdb1d10011ad0ff90774d0c6bb92e5c5c8b4461f7" "0x7b8a01b39d58278b5de7e48c8449c9f4f5170613" "0xb971ef87ede563556b2ed4b1c0b0019111dd85d2"


main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
