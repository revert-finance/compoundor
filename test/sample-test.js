const { BigNumber } = require("@ethersproject/bignumber");
const { expect } = require("chai");
const { ethers } = require("hardhat");
const hre = require("hardhat");

const wethAddress = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
const usdcAddress = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
const usdtAddress = "0xdAC17F958D2ee523a2206206994597C13D831ec7"

const factoryAddress = "0x1F98431c8aD98523631AE4a59f267346ea31F984"
const nonfungiblePositionManagerAddress = "0xC36442b4a4522E871399CD717aBDD847Ab11FE88"
const swapRouterAddress = "0xE592427A0AEce92De3Edee1F18E0157C05861564"

const haydenAddress = "0x11e4857bb9993a50c685a79afad4e6f65d518dda"

describe("AutoCompounder Tests", function () {

  let contract, nonfungiblePositionManager, factory, owner;

  beforeEach(async function () {
      const Contract = await ethers.getContractFactory("Contract");
      contract = await Contract.deploy(wethAddress, factoryAddress, nonfungiblePositionManagerAddress, swapRouterAddress);
      await contract.deployed();

      nonfungiblePositionManager = await ethers.getContractAt("INonfungiblePositionManager", nonfungiblePositionManagerAddress); 
      factory = await ethers.getContractAt("IUniswapV3Factory", factoryAddress);
  
      [owner] = await ethers.getSigners();
  });

  it("Test swapAndMint", async function () {
    const deadline = Math.floor(new Date().getTime() / 1000)
    const usdc = await ethers.getContractAt("IERC20", usdcAddress);
    const weth = await ethers.getContractAt("IERC20", wethAddress);

    const amountETH = BigNumber.from("1000000000000000000")
    const amountUSDC = BigNumber.from("1000000000")

    const haydenSigner = await impersonateAccountAndGetSigner(haydenAddress)

    const minTick = -800000;
    const mediumTick = 0;
    const maxTick = 800000;

    const token0 = usdcAddress
    const token1 = wethAddress

    const fee = 500

    // pure eth
    await usdc.connect(haydenSigner).approve(contract.address, amountUSDC)
    await contract.connect(haydenSigner).swapAndMint({ token0, token1, fee, tickLower: minTick, tickUpper:maxTick, amount0: amountUSDC ,amount1: amountETH, recipient:haydenAddress, deadline}, {value: amountETH});

    // half eth / half weth
    await usdc.connect(haydenSigner).approve(contract.address, amountUSDC)
    await weth.connect(haydenSigner).approve(contract.address, amountETH.div(2))
    await contract.connect(haydenSigner).swapAndMint({ token0, token1, fee, tickLower: minTick, tickUpper:mediumTick, amount0: amountUSDC ,amount1: amountETH, recipient:haydenAddress, deadline}, {value: amountETH.div(2)});
    
    // pure weth
    await usdc.connect(haydenSigner).approve(contract.address, amountUSDC)
    await weth.connect(haydenSigner).approve(contract.address, amountETH)
    await contract.connect(haydenSigner).swapAndMint({ token0, token1, fee, tickLower: mediumTick, tickUpper:maxTick, amount0: amountUSDC ,amount1: amountETH, recipient:haydenAddress, deadline}, {value: 0});
  })

  it("Test main functionality with hayden position 8", async function () {

    const nftId = 8
    const haydenSigner = await impersonateAccountAndGetSigner(haydenAddress)

    const deadline = Math.floor(new Date().getTime() / 1000)
   
    await nonfungiblePositionManager.connect(haydenSigner)[["safeTransferFrom(address,address,uint256)"]](haydenAddress, contract.address, nftId);

    // add liquidity (one)
    const usdc = await ethers.getContractAt("IERC20", usdcAddress);
    const usdt = await ethers.getContractAt("IERC20", usdtAddress);
    const amount = BigNumber.from("1000000")
    await usdc.connect(haydenSigner).approve(contract.address, amount)
    //await usdt.connect(haydenSigner).approve(contract.address, amount)

    //await contract.connect(haydenSigner).swapAndIncreaseLiquidity({ tokenId: nftId, amount0: amount, amount1: "0", deadline});

    // autocompound without trade
    const position = await nonfungiblePositionManager.positions(nftId);
    const [bonus0, bonus1] = await contract.callStatic.autoCompound( { tokenId: nftId, bonusConversion: 0, withdrawBonus: false, deadline })

    const gasCost = await contract.estimateGas.autoCompound( { tokenId: nftId, bonusConversion: 0, withdrawBonus: false, deadline })

    const gasPrice = await ethers.provider.getGasPrice()
    console.log("Gas Price", gasPrice)
    console.log("Execution cost:", ethers.utils.formatEther(gasPrice.mul(gasCost)))

    // simulate cost vs gains
    const tokenPrice0X96 = await getTokenETHPriceX96(factory, position.token0);
    const tokenPrice1X96 = await getTokenETHPriceX96(factory, position.token1);

    const gain0 = parseFloat(ethers.utils.formatEther(bonus0.mul(tokenPrice0X96).div(BigNumber.from(2).pow(96))))
    const gain1 = parseFloat(ethers.utils.formatEther(bonus1.mul(tokenPrice1X96).div(BigNumber.from(2).pow(96))))

    console.log("Execution gain:", gain0 + gain1)

    await contract.autoCompound( { tokenId: nftId, bonusConversion: 0, withdrawBonus: false, deadline })
    await contract.autoCompound( { tokenId: nftId, bonusConversion: 0, withdrawBonus: false, deadline })
    await contract.autoCompound( { tokenId: nftId, bonusConversion: 0, withdrawBonus: false, deadline })
    await contract.autoCompound( { tokenId: nftId, bonusConversion: 0, withdrawBonus: false, deadline })
    await contract.autoCompound( { tokenId: nftId, bonusConversion: 0, withdrawBonus: false, deadline })

    // withdraw bonus 1 by 1
    await contract.withdrawBalance(position.token0, owner.address, bonus0)
    await contract.withdrawBalance(position.token1, owner.address, bonus1)

    // remove token - and remaining balances
    await contract.connect(haydenSigner).withdrawToken(nftId, haydenAddress, 0, true);
  });
});


async function impersonateAccountAndGetSigner(address) {
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [address],
  });

  return await ethers.getSigner(address)
}

async function balance(address) {
  return await ethers.provider.getBalance(address);
}

async function mine(nBlocks) {
  for (let i = 0; i < nBlocks; i++) {
    await ethers.provider.send('evm_mine');
  }
}

async function wait(secs) {
  await ethers.provider.send('evm_increaseTime', [secs]);
}


async function getTokenETHPriceX96(factory, address) {
  for(let fee of [100, 500, 3000, 10000]) {
    const poolAddress = await factory.getPool(address, wethAddress, fee);
    if (poolAddress > 0) {
      const poolContract = await ethers.getContractAt("IUniswapV3Pool", poolAddress);
      const isToken1WETH = (await poolContract.token1()).toLowerCase() == wethAddress.toLowerCase();
      const slot0 = await poolContract.slot0()
      return isToken1WETH ? slot0.sqrtPriceX96.pow(2).div(BigNumber.from(2).pow(192 - 96)) : BigNumber.from(2).pow(192 + 96).div(slot0.sqrtPriceX96.pow(2))
    }
  }
}