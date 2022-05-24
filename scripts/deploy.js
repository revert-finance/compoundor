require('dotenv').config()

const hre = require("hardhat");

const wethAddress = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" //polygon "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270"
const factoryAddress = "0x1F98431c8aD98523631AE4a59f267346ea31F984"
const nonfungiblePositionManagerAddress = "0xC36442b4a4522E871399CD717aBDD847Ab11FE88"
const swapRouterAddress = "0xE592427A0AEce92De3Edee1F18E0157C05861564"

async function main() {

  const signer = new hre.ethers.Wallet(process.env.DEPLOYMENT_PRIVATE_KEY, hre.ethers.provider)

  const Contract = await hre.ethers.getContractFactory("Contract", signer);
  const contract = await Contract.deploy(wethAddress, factoryAddress, nonfungiblePositionManagerAddress, swapRouterAddress);
  await contract.deployed();

  console.log("Deployed at", contract.address)

  // add test position 
  const usdcAddress = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
  const deadline = (await hre.ethers.provider.getBlock("latest")).timestamp + 300

  const tx = await contract.swapAndMint({ token0: usdcAddress, token1: wethAddress, fee: 500, amount0: "0", amount1: "100000000000", tickLower: -800000, tickUpper: 800000, recipient: signer.address, deadline: deadline }, { value: "100000000000" })
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
