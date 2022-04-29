const { BigNumber } = require("@ethersproject/bignumber");
const { expect } = require("chai");
const { ethers } = require("hardhat");
const hre = require("hardhat");

const { Pool, Position } = require("@uniswap/v3-sdk")
const { Token, CurrencyAmount, Fraction, Percent } = require("@uniswap/sdk-core")

const wethAddress = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
const usdcAddress = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
const usdtAddress = "0xdAC17F958D2ee523a2206206994597C13D831ec7"


const factoryAddress = "0x1F98431c8aD98523631AE4a59f267346ea31F984"
const nonfungiblePositionManagerAddress = "0xC36442b4a4522E871399CD717aBDD847Ab11FE88"
const swapRouterAddress = "0xE592427A0AEce92De3Edee1F18E0157C05861564"


const haydenAddress = "0x11e4857bb9993a50c685a79afad4e6f65d518dda"
const nftId = 8

describe("AutoCompounder", function () {
  it("Simple test with hayden position", async function () {

    const [owner] = await ethers.getSigners();
    
    const deadline = Math.floor(new Date().getTime() / 1000)

    const Contract = await ethers.getContractFactory("Contract");
    const contract = await Contract.deploy(wethAddress, factoryAddress, nonfungiblePositionManagerAddress, swapRouterAddress);
    await contract.deployed();

    const nonfungiblePositionManager = await ethers.getContractAt("INonfungiblePositionManager", nonfungiblePositionManagerAddress); 
    const factory = await ethers.getContractAt("IUniswapV3Factory", factoryAddress);

    const haydenSigner = await impersonateAccountAndGetSigner(haydenAddress);

    // create position
    // approve both tokens

    const usdc = await ethers.getContractAt("IERC20", usdcAddress);
    const weth = await ethers.getContractAt("IERC20", wethAddress);
    const usdt = await ethers.getContractAt("IERC20", usdtAddress);
    await usdc.connect(haydenSigner).approve(contract.address, "1000000") // 1 USDC
    await weth.connect(haydenSigner).approve(contract.address, "1000000000000000") //0.001 ETH

    const result = await contract.connect(haydenSigner).callStatic.mintAndSwap({ token0: usdcAddress, token1: wethAddress, fee: 500, tickLower: 800000, tickUpper:801000, amount0: "1000000",amount1: "1000000000000000", recipient:haydenAddress, deadline});
    console.log(result)
    //await contract.connect(haydenSigner).mintAndSwap({ token0: usdcAddress, token1: wethAddress, fee: 500, tickLower: -10, tickUpper:10, amount0: "1000000",amount1: "1000000000000000", recipient:haydenAddress, deadline});

    await nonfungiblePositionManager.connect(haydenSigner)[["safeTransferFrom(address,address,uint256)"]](haydenAddress, contract.address, nftId);

    console.log("Transfered")

    // autocompound without trade
    const position = await nonfungiblePositionManager.positions(nftId);
    const [bonus0, bonus1] = await contract.callStatic.autoCompound( { tokenId: nftId, bonusConversion: 0, withdrawBonus: false, deadline })

    const gasCost = await contract.estimateGas.autoCompound( { tokenId: nftId, bonusConversion: 0, withdrawBonus: false, deadline })

    const gasPrice = await ethers.provider.getGasPrice()
    console.log("Execution cost:", ethers.utils.formatEther(gasPrice.mul(gasCost)))

    // simulate cost vs gains
    const tokenPrice0X96 = await getTokenETHPriceX96(factory, position.token0);
    const tokenPrice1X96 = await getTokenETHPriceX96(factory, position.token1);

    const gain0 = parseFloat(ethers.utils.formatEther(bonus0.mul(tokenPrice0X96).div(BigNumber.from(2).pow(96))))
    const gain1 = parseFloat(ethers.utils.formatEther(bonus1.mul(tokenPrice1X96).div(BigNumber.from(2).pow(96))))

    console.log("Execution gain:", gain0 + gain1)

    await contract.autoCompound( { tokenId: nftId, bonusConversion: 0, withdrawBonus: false, deadline })

    // withdraw bonus 1 by 1
    await contract.withdrawBalance(position.token0, owner.address, bonus0)
    await contract.withdrawBalance(position.token1, owner.address, bonus1)

    console.log(await usdc.balanceOf(contract.address))
    console.log(await usdt.balanceOf(contract.address))

    // remove token - and remaining balances
    await contract.connect(haydenSigner).withdrawToken(nftId, haydenAddress, 0, true);

    console.log(await usdc.balanceOf(contract.address))
    console.log(await usdt.balanceOf(contract.address))

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




/*
async function calculatePerfectAmounts(nftId, signer, contract, factory, nonfungiblePositionManager) {

  const position = await nonfungiblePositionManager.positions(nftId);
  const owner = await nonfungiblePositionManager.ownerOf(nftId);

  const collects = await nonfungiblePositionManager.connect(signer).callStatic.collect({tokenId:nftId, recipient: owner, amount0Max: BigNumber.from(2).pow(128).sub(1), amount1Max: BigNumber.from(2).pow(128).sub(1)})

  const token0Amount = (await contract.userBalances(owner, position.token0)).add(collects.amount0);
  const token1Amount = (await contract.userBalances(owner, position.token1)).add(collects.amount1);

  const poolAddress = await factory.getPool(position.token0, position.token1, position.fee);

  const poolContract = await ethers.getContractAt("IUniswapV3Pool", poolAddress);
  const token0Contract = await ethers.getContractAt("IERC20Metadata", position.token0);
  const token1Contract = await ethers.getContractAt("IERC20Metadata", position.token1);

  const slot0 = await poolContract.slot0()
  const liquidity = await poolContract.liquidity()

  const token0 = new Token(
    1,
    position.token0,
    await token0Contract.decimals()
  );
  
  const token1 = new Token(
    1,
    position.token1,
    await token1Contract.decimals()
  );

  const pool = new Pool(
    token0,
    token1,
    position.fee,
    slot0.sqrtPriceX96,
    liquidity,
    slot0.tick
  );

  const pos = new Position({
    pool,
    tickLower: position.tickLower,
    tickUpper: position.tickUpper,
    liquidity: position.liquidity,
  })


  const amount0 = ethers.utils.parseUnits(pos.amount0.toFixed(token0.decimals), token0.decimals)
  const amount1 = ethers.utils.parseUnits(pos.amount1.toFixed(token1.decimals), token1.decimals)

  const x96 = BigNumber.from(2).pow(96);

  // use to calculate ratio in quantity
  const amountRatioX96 = amount0.mul(x96).div(amount1);

  // price token0 to token1
  const priceX96 = slot0.sqrtPriceX96.pow(2).div(x96);

  // calculcate how much to add to token0 to get balance
  let delta0 = BigNumber.from(0)
  if (amount0.eq(0)) {
    delta0 = token0Amount.mul(-1);
  } else if (amount1.eq(0)) {
    delta0 = token1Amount.mul(x96).div(priceX96)
  } else {
    delta0 = (amountRatioX96.mul(token1Amount).sub(token0Amount.mul(x96))).div(amountRatioX96.mul(priceX96).div(x96).add(x96))
  }

  console.log(delta0.toString())

  const delta1 = delta0.mul(-1).mul(priceX96).div(x96);

  console.log(delta1.toString())

  return [token0Amount.add(delta0), token1Amount.add(delta1)]
}*/