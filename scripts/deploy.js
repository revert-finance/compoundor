require('dotenv').config()

const hre = require("hardhat");

const nativeTokenAddresses = {
  "mainnet" : "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  "polygon" : "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270",
  "optimism" : "0x4200000000000000000000000000000000000006",
  "arbitrum" : "0x82af49447d8a07e3bd95bd0d56f35241523fbab1",
  "unichain" : "0x4200000000000000000000000000000000000006"
}

const factoryAddresses = {
  "mainnet": "0x1F98431c8aD98523631AE4a59f267346ea31F984",
  "polygon": "0x1F98431c8aD98523631AE4a59f267346ea31F984",
  "optimism": "0x1F98431c8aD98523631AE4a59f267346ea31F984",
  "arbitrum": "0x1F98431c8aD98523631AE4a59f267346ea31F984",
  "unichain": "0x1f98400000000000000000000000000000000003"
}

const nonfungiblePositionManagerAddresses = {
  "mainnet": "0xC36442b4a4522E871399CD717aBDD847Ab11FE88",
  "polygon": "0xC36442b4a4522E871399CD717aBDD847Ab11FE88",
  "optimism": "0xC36442b4a4522E871399CD717aBDD847Ab11FE88",
  "arbitrum": "0xC36442b4a4522E871399CD717aBDD847Ab11FE88",
  "unichain": "0x943e6e07a7e8e791dafc44083e54041d743c46e9"
}

const swapRouterAddresses = {
  "mainnet": "0xE592427A0AEce92De3Edee1F18E0157C05861564",
  "polygon": "0xE592427A0AEce92De3Edee1F18E0157C05861564",
  "optimism": "0xE592427A0AEce92De3Edee1F18E0157C05861564",
  "arbitrum": "0xE592427A0AEce92De3Edee1F18E0157C05861564",
  "unichain": "0x73855d06de49d0fe4a9c42636ba96c62da12ff9c"
}

async function main() {
  let gasPrice, gasLimit;
  if (hre.network.name === "unichain") {
    gasPrice = hre.ethers.utils.parseUnits('1', 'gwei'); // or whatever is typical for Unichain
    gasLimit = 6000000;
  } else {
    gasPrice = hre.ethers.utils.parseUnits('200', 'gwei'); // your previous default
    gasLimit = 6000000;
  }

  const signer = new hre.ethers.Wallet(process.env.DEPLOYMENT_PRIVATE_KEY, hre.ethers.provider)

  console.log("Deploying on", hre.network.name)

  const nativeTokenAddress = nativeTokenAddresses[hre.network.name]
  const factoryAddress = factoryAddresses[hre.network.name]
  const nonfungiblePositionManagerAddress = nonfungiblePositionManagerAddresses[hre.network.name]
  const swapRouterAddress = swapRouterAddresses[hre.network.name]

  const Contract = await hre.ethers.getContractFactory("SelfCompoundor", signer);
  
  const contract = await Contract.deploy(
    nonfungiblePositionManagerAddress,
    swapRouterAddress,
    { gasPrice, gasLimit }
  );
  await contract.deployed();

  //await contract.transferOwnership(process.env.MULTISIG_ACCOUNT);

  console.log("Deployed at", contract.address)
  console.log("Factory:", factoryAddress)
  console.log("NonfungiblePositionManager:", nonfungiblePositionManagerAddress)
  console.log("SwapRouter:", swapRouterAddress)
}

// npx hardhat verify --network mainnet "" "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" "0x1F98431c8aD98523631AE4a59f267346ea31F984" "0xC36442b4a4522E871399CD717aBDD847Ab11FE88" "0xE592427A0AEce92De3Edee1F18E0157C05861564"
// npx hardhat verify --network polygon "" "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270" "0x1F98431c8aD98523631AE4a59f267346ea31F984" "0xC36442b4a4522E871399CD717aBDD847Ab11FE88" "0xE592427A0AEce92De3Edee1F18E0157C05861564"
// npx hardhat verify --network optimism "" "0x4200000000000000000000000000000000000006" "0x1F98431c8aD98523631AE4a59f267346ea31F984" "0xC36442b4a4522E871399CD717aBDD847Ab11FE88" "0xE592427A0AEce92De3Edee1F18E0157C05861564"
// npx hardhat verify --network arbitrum "" "0x82af49447d8a07e3bd95bd0d56f35241523fbab1" "0x1F98431c8aD98523631AE4a59f267346ea31F984" "0xC36442b4a4522E871399CD717aBDD847Ab11FE88" "0xE592427A0AEce92De3Edee1F18E0157C05861564"

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
