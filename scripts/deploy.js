require('dotenv').config()

const hre = require("hardhat");

const nativeTokenAddresses = {
  "bnb" : "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c"
}

const factoryAddress = "0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865"
const nonfungiblePositionManagerAddress = "0x46A15B0b27311cedF172AB29E4f4766fbE7F4364"
const swapRouterAddress = "0x13f4EA83D0bd40E75C8222255bc855a974568Dd4"

async function main() {

  // set manually for each network
  //const gasPrice = 50000000000
  //const gasLimit = 6000000

  const signer = new hre.ethers.Wallet(process.env.DEPLOYMENT_PRIVATE_KEY, hre.ethers.provider)

  console.log("Deploying on", hre.network.name)

  const nativeTokenAddress = nativeTokenAddresses[hre.network.name]

  const Contract = await hre.ethers.getContractFactory("Compoundor", signer);
  
  const contract = await Contract.deploy(nativeTokenAddress, factoryAddress, nonfungiblePositionManagerAddress, swapRouterAddress);
  await contract.deployed();

  //await contract.transferOwnership(process.env.MULTISIG_ACCOUNT);

  console.log("Deployed at", contract.address)
}

// npx hardhat verify --network bnb "0x905175Feb7AC3EAd2b09EA206BF1A5b7A5dAEa9e" "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c" "0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865" "0x46A15B0b27311cedF172AB29E4f4766fbE7F4364" "0x13f4EA83D0bd40E75C8222255bc855a974568Dd4"


main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
