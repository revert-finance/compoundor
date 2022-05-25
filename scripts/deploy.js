require('dotenv').config()

const hre = require("hardhat");

const wethAddress = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
const wmaticAddress = "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270"
const factoryAddress = "0x1F98431c8aD98523631AE4a59f267346ea31F984"
const nonfungiblePositionManagerAddress = "0xC36442b4a4522E871399CD717aBDD847Ab11FE88"
const swapRouterAddress = "0xE592427A0AEce92De3Edee1F18E0157C05861564"

async function main() {

  const signer = new hre.ethers.Wallet(process.env.DEPLOYMENT_PRIVATE_KEY, hre.ethers.provider)

  const nativeTokenAddress = hre.network.name == "polygon" ? wmaticAddress : wethAddress

  const Contract = await hre.ethers.getContractFactory("Contract", signer);
  const contract = await Contract.deploy(nativeTokenAddress, factoryAddress, nonfungiblePositionManagerAddress, swapRouterAddress);
  await contract.deployed();

  console.log("Deployed at", contract.address)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
