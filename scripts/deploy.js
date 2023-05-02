require('dotenv').config()

const hre = require("hardhat");

const nativeTokenAddresses = {
  "bnb" : "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
  "evmos": "0xD4949664cD82660AaE99bEdc034a0deA8A0bd517"
}

const factoryAddress = "0xf544365e7065966f190155f629ce0182fc68eaa2"
const nonfungiblePositionManagerAddress = "0x5fe5daaa011673289847da4f76d63246ddb2965d"
const swapRouterAddress = "0x5b5e44da9718288244110e66a7ca6c537f36f948"

async function main() {

  // set manually for each network
  const gasPrice = 50000000000
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

// npx hardhat verify --network bnb "" "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c" "0xdb1d10011ad0ff90774d0c6bb92e5c5c8b4461f7" "0x7b8a01b39d58278b5de7e48c8449c9f4f5170613" "0xb971ef87ede563556b2ed4b1c0b0019111dd85d2"
// npx hardhat verify --network evmos "0x013573fa9fAF879DB49855aDdF10653F46903419" "0xD4949664cD82660AaE99bEdc034a0deA8A0bd517" "0xf544365e7065966f190155f629ce0182fc68eaa2" "0x5fe5daaa011673289847da4f76d63246ddb2965d" "0x5b5e44da9718288244110e66a7ca6c537f36f948"



main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
