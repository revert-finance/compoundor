const { BigNumber } = require("@ethersproject/bignumber");
const { expect, assert } = require("chai");
const { ethers } = require("hardhat");
const hre = require("hardhat");

const wethAddress = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
const usdcAddress = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
const usdtAddress = "0xdAC17F958D2ee523a2206206994597C13D831ec7"
const uniAddress = "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984"
const wbtcAddress = "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599"

const factoryAddress = "0x1F98431c8aD98523631AE4a59f267346ea31F984"
const nonfungiblePositionManagerAddress = "0xC36442b4a4522E871399CD717aBDD847Ab11FE88"
const swapRouterAddress = "0xE592427A0AEce92De3Edee1F18E0157C05861564"

const haydenAddress = "0x11E4857Bb9993a50c685A79AFad4E6F65D518DDa"
const zeroAddress = "0x0000000000000000000000000000000000000000"


describe("AutoCompounder Tests", function () {

  let contract, nonfungiblePositionManager, factory, owner, otherAccount;

  beforeEach(async function () {
      const Contract = await ethers.getContractFactory("Compoundor");
      contract = await Contract.deploy(wethAddress, factoryAddress, nonfungiblePositionManagerAddress, swapRouterAddress);
      await contract.deployed();

      // use interface instead of contract to test
      contract = await ethers.getContractAt("ICompoundor", contract.address)

      nonfungiblePositionManager = await ethers.getContractAt("INonfungiblePositionManager", nonfungiblePositionManagerAddress);
      factory = await ethers.getContractAt("IUniswapV3Factory", factoryAddress);

      [owner, otherAccount] = await ethers.getSigners();
  });

  it("Test setBonus", async function () {

    const totalBonus = await contract.totalBonusX64();
    const compounderBonus = await contract.compounderBonusX64();

    // total bonus is 2%
    expect(totalBonus).to.equal(BigNumber.from(2).pow(64).div(50));

    // total bonus can only be decreased
    await expect(contract.setBonus(totalBonus.add(1), compounderBonus)).to.be.reverted;
    await contract.setBonus(totalBonus.sub(1), compounderBonus.sub(1));
    const totalBonusPost = await contract.totalBonusX64();
    const compounderBonusPost = await contract.compounderBonusX64();
    expect(totalBonusPost).to.equal(totalBonus.sub(1));
    expect(compounderBonusPost).to.equal(compounderBonus.sub(1));

    // compounder bonus can be increased, but can't be greater than max bonus
    await expect(contract.setBonus(totalBonusPost, compounderBonusPost.add(1)));
    await expect(contract.setBonus(totalBonusPost, totalBonusPost.add(1))).to.be.reverted;
    expect(await contract.compounderBonusX64()).to.equal(compounderBonusPost.add(1));

    await contract.setBonus(0, 0);
    expect(await contract.totalBonusX64()).to.equal(0);
    expect(await contract.compounderBonusX64()).to.equal(0);
  });

  it("Test setTWAPConfig", async function() {
    const maxTTD = await contract.maxTWAPTickDifference();
    const twapSecs = await contract.TWAPSeconds();
    await contract.setTWAPConfig(maxTTD - 50, twapSecs - 50);
    const maxTTDPost = await contract.maxTWAPTickDifference();
    const twapSecsPost = await contract.TWAPSeconds();
    expect(maxTTD- 50).to.equal(maxTTDPost);
    expect(twapSecs- 50).to.equal(twapSecsPost);
  });

  it("Test random positions", async function () {
    const minBalanceToSafeTransfer = BigNumber.from("500000").mul(await ethers.provider.getGasPrice()) 
    const totalSupply = await nonfungiblePositionManager.totalSupply();

    const positionIndices = [345, 367, 14003, 54999, 144000];
    for(let i of positionIndices) {
    //for (let i = totalSupply - 900; i < totalSupply - 500; i++) {
      const tokenId = await nonfungiblePositionManager.tokenByIndex(i);
      const ownerAddress = await nonfungiblePositionManager.ownerOf(tokenId);
      const ownerBalance = await ethers.provider.getBalance(ownerAddress)
      if (ownerBalance.gt(minBalanceToSafeTransfer)) {
        const ownerSigner = await impersonateAccountAndGetSigner(ownerAddress)
        await nonfungiblePositionManager.connect(ownerSigner)[["safeTransferFrom(address,address,uint256)"]](ownerAddress, contract.address, tokenId, { gasLimit: 500000 });
        const deadline = await getDeadline();
        const [bonus0, bonus1] = await contract.callStatic.autoCompound( { tokenId, bonusConversion: 0, withdrawBonus: false, doSwap: true });
        await contract.autoCompound( { tokenId, bonusConversion: 0, withdrawBonus: false, doSwap: true });
      }
    }
  })


  it("test position transfer and withdrawal", async function () {
    const nftId = 1
    const haydenSigner = await impersonateAccountAndGetSigner(haydenAddress);
    const deadline = await getDeadline();

    await nonfungiblePositionManager.connect(haydenSigner)[["safeTransferFrom(address,address,uint256)"]](haydenAddress, contract.address, nftId);
    const nftOwner = await contract.ownerOf(nftId);
    const nftStored = await contract.accountTokens(haydenAddress, 0);

    // expect owner to match og
    expect(nftOwner).to.equal(haydenAddress);
    expect(nftStored).to.equal(nftId);
    expect(await contract.balanceOf(haydenAddress)).to.equal(1);


    // withdraw token
    await contract.connect(haydenSigner).withdrawToken(nftId, haydenAddress, true, 0);

    // token no longer in contract
    expect(await contract.connect(haydenSigner).callStatic.ownerOf(nftId)).to.equal(zeroAddress);
    expect(await contract.balanceOf(haydenAddress)).to.equal(0);

  })

  it("Test one sided liquidity position with hayden position 1", async function () {

    const nftId = 1
    const haydenSigner = await impersonateAccountAndGetSigner(haydenAddress)
    const deadline = await getDeadline()

    await nonfungiblePositionManager.connect(haydenSigner)[["safeTransferFrom(address,address,uint256)"]](haydenAddress, contract.address, nftId);

    // check bonus payouts
    const [bonus0a, bonus1a] = await contract.callStatic.autoCompound( { tokenId: nftId, bonusConversion: 0, withdrawBonus: false, doSwap: true })
    expect(bonus0a).to.gt(0)
    expect(bonus1a).to.eq(0)
    const [bonus0b, bonus1b] = await contract.callStatic.autoCompound( { tokenId: nftId, bonusConversion: 1, withdrawBonus: false, doSwap: true })
    expect(bonus0b).to.gt(0)
    expect(bonus1b).to.eq(0)
    const [bonus0c, bonus1c] = await contract.callStatic.autoCompound( { tokenId: nftId, bonusConversion: 2, withdrawBonus: false, doSwap: true })
    expect(bonus0c).to.eq(0)
    expect(bonus1c).to.gt(0)

    // autompound to UNI fees - withdraw and add
    await contract.autoCompound( { tokenId: nftId, bonusConversion: 1, withdrawBonus: true, doSwap: true })

    // withdraw token
    await contract.connect(haydenSigner).withdrawToken(nftId, haydenAddress, true, 0);
  })



  it("Test decreaseLiquidityAndCollect", async function () {
    const nftId = 8
    const haydenSigner = await impersonateAccountAndGetSigner(haydenAddress)
    const deadline = await getDeadline()
    const usdc = await ethers.getContractAt("IERC20", usdcAddress);
    const usdt = await ethers.getContractAt("IERC20", usdtAddress);


    usdcBalancePre = await usdc.balanceOf(haydenAddress);
    usdtBalancePre = await usdt.balanceOf(haydenAddress);

    // static collect from nft manager
    const [mngrA0, mngrA1] = await nonfungiblePositionManager.connect(haydenSigner).callStatic.decreaseLiquidity({ tokenId: nftId, liquidity:"100000000", amount0Min: "0", amount1Min: "0", deadline: deadline});

    // transfer to autocompounder contract and do static decreaseLiquidityAndCollect
    await nonfungiblePositionManager.connect(haydenSigner)[["safeTransferFrom(address,address,uint256)"]](haydenAddress, contract.address, nftId);
    const [a0, a1] = await contract.connect(haydenSigner).callStatic.decreaseLiquidityAndCollect({ tokenId: nftId, liquidity:"100000000", amount0Min: "0", amount1Min: "0", deadline: deadline, recipient: haydenAddress});

    // expect amounts to match
    expect(mngrA0).to.equal(a0);
    expect(mngrA1).to.equal(a1);

    // actually perform the decrese liquidity and colllect
    const x = await contract.connect(haydenSigner).decreaseLiquidityAndCollect({ tokenId: nftId, liquidity:"100000000", amount0Min: "0", amount1Min: "0", deadline: deadline, recipient: haydenAddress});


    // expect post decrease liquidity balances to match pre+amount removed
    usdcBalancePost = await usdc.balanceOf(haydenAddress);
    usdtBalancePost = await usdt.balanceOf(haydenAddress);
    expect(usdcBalancePost).to.equal(usdcBalancePre.add(a0));
    expect(usdtBalancePost).to.equal(usdtBalancePre.add(a1));

    // withdraw token
    await contract.connect(haydenSigner).withdrawToken(nftId, haydenAddress, true, 0);

  });

  it("test that amounts match for all roles (no swap)", async function () {

    const nftId = 17193
    const nftOwnerAddress =  "0x2706c4587510c470A6825AE33bB13e5D1718677c";
    const nftOwnerSigner = await impersonateAccountAndGetSigner(nftOwnerAddress)

    // send ether to account - so it has enough to call all the functions
    await owner.sendTransaction({
      to: nftOwnerAddress,
      value: ethers.utils.parseEther("0.015")
    });

    const compoundor = otherAccount;

    // get uncollected fee amounts
    const [a0, a1] = await nonfungiblePositionManager.connect(nftOwnerSigner).callStatic.collect([nftId,
                                                                                                  nftOwnerAddress,
                                                                                                  "1000000000000000000000000000000",
                                                                                                  "1000000000000000000000000000000"]);

    // transfer NFT to autocompounder
    await nonfungiblePositionManager.connect(nftOwnerSigner)[["safeTransferFrom(address,address,uint256)"]](nftOwnerAddress, contract.address, nftId);

    const token0 = await ethers.getContractAt("IERC20", wbtcAddress);
    const token1 = await ethers.getContractAt("IERC20", wethAddress);

    // check autocompound result and gas costs
    const [b0,b1, compounded0, compounded1] = await contract.connect(compoundor).callStatic.autoCompound({tokenId: nftId,
                                                                                                          bonusConversion: 0,
                                                                                                          withdrawBonus: false,
                                                                                                          doSwap: false})
    const totalBonusX64 = await contract.totalBonusX64();
    const compounderBonusX64 = await contract.compounderBonusX64();
    const protocolFee0 = b0.mul(totalBonusX64).div(compounderBonusX64).sub(b0);
    const protocolFee1 = b1.mul(totalBonusX64).div(compounderBonusX64).sub(b1).sub(1); // protocol fee gets rounded down if required
    const buffer0 = a0.sub(compounded0).sub(b0).sub(protocolFee0);
    const buffer1 = a1.sub(compounded1).sub(b1).sub(protocolFee1);

    // execute autocompound (from owner contract)
    await contract.connect(compoundor).autoCompound({tokenId: nftId,
                                                     bonusConversion: 0,
                                                     withdrawBonus: false,
                                                     doSwap: false});



    const summedAmounts0 = compounded0.add(b0).add(protocolFee0).add(buffer0);
    const summedAmounts1 = compounded1.add(b1).add(protocolFee1).add(buffer1);

    // summed amounts match uncollected amounts
    expect(summedAmounts0).to.equal(a0);
    expect(summedAmounts1).to.equal(a1);

    // bonus is correct proportion of compounded fees
    expect(b0).to.equal(compounded0.mul(compounderBonusX64).div(BigNumber.from(2).pow(64)));
    expect(b1).to.equal(compounded1.mul(compounderBonusX64).div(BigNumber.from(2).pow(64)).add(1)); // compoundor bonus gets rounded up if required

    // contract balaces match expected amounts
    expect(await contract.accountBalances(compoundor.address, token0.address)).to.equal(b0);
    expect(await contract.accountBalances(compoundor.address, token1.address)).to.equal(b1);
    expect(await contract.accountBalances(owner.address, token0.address)).to.equal(protocolFee0);
    expect(await contract.accountBalances(owner.address, token1.address)).to.equal(protocolFee1);
    expect(await contract.accountBalances(nftOwnerAddress, token0.address)).to.equal(buffer0);
    expect(await contract.accountBalances(nftOwnerAddress, token1.address)).to.equal(buffer1);


    await contract.connect(nftOwnerSigner).withdrawToken(nftId, nftOwnerAddress, true, 0);


  });

  it("test withdraw balances for all roles", async function () {


    const nftId = 108881
    const nftOwnerAddress =  "0xB5893a338CE1E5304732D223C703A65125765be2";
    const nftOwnerSigner = await impersonateAccountAndGetSigner(nftOwnerAddress)
    const deadline = await getDeadline()

    const compoundor = otherAccount;

    const [a0, a1] = await nonfungiblePositionManager.connect(nftOwnerSigner).callStatic.collect([nftId, nftOwnerAddress, "1000000000000000000000000000000", "1000000000000000000000000000000"]);

    // transfer NFT to autocompounder
    await nonfungiblePositionManager.connect(nftOwnerSigner)[["safeTransferFrom(address,address,uint256)"]](nftOwnerAddress, contract.address, nftId);

    const token0 = await ethers.getContractAt("IERC20", wbtcAddress);
    const token1 = await ethers.getContractAt("IERC20", wethAddress);

    // check autocompound result and gas costs
    const [b0,b1, compounded0, compounded1] = await contract.connect(compoundor).callStatic.autoCompound({tokenId: nftId, bonusConversion: 0, withdrawBonus: false, doSwap: true})
    const totalBonusX64 = await contract.totalBonusX64();
    const compounderBonusX64 = await contract.compounderBonusX64();

    // execute autocompound (from owner contract)
    await contract.connect(compoundor).autoCompound({ tokenId: nftId, bonusConversion: 0, withdrawBonus: false, doSwap: true })

    // get amounts leftover in buffer
    const buffer0 = await contract.accountBalances(nftOwnerAddress, token0.address);
    const buffer1 = await contract.accountBalances(nftOwnerAddress, token1.address);

    // get accrued protocol fees
    const protocolA0 = await contract.accountBalances(owner.address, token0.address);
    const protocolA1 = await contract.accountBalances(owner.address, token1.address);

    await contract.connect(compoundor).withdrawBalance(token0.address, compoundor.address, b0);
    await contract.connect(compoundor).withdrawBalance(token1.address, compoundor.address, b1);
    await contract.connect(owner).withdrawBalance(token0.address, owner.address, protocolA0);
    await contract.connect(owner).withdrawBalance(token1.address, owner.address, protocolA1);
    await contract.connect(nftOwnerSigner).withdrawBalance(token0.address, nftOwnerAddress, buffer0);
    await contract.connect(nftOwnerSigner).withdrawBalance(token1.address, nftOwnerAddress, buffer1);

    expect(await token0.balanceOf(contract.address)).to.equal(0);
    expect(await token1.balanceOf(contract.address)).to.equal(0);

    await contract.connect(nftOwnerSigner).withdrawToken(nftId, nftOwnerAddress, true, 0);
  });


  it("Test main functionality with hayden position 8", async function () {

    const nftId = 8
    const haydenSigner = await impersonateAccountAndGetSigner(haydenAddress)
    const deadline = await getDeadline()

    // get collect amount (for later amount checks)
    const [a0, a1] = await nonfungiblePositionManager.connect(haydenSigner).callStatic.collect([nftId, haydenAddress, "1000000000000000000000000000000", "1000000000000000000000000000000"]);

    // add NFT to autocompounder
    await nonfungiblePositionManager.connect(haydenSigner)[["safeTransferFrom(address,address,uint256)"]](haydenAddress, contract.address, nftId);

    // check token added
    expect(await contract.balanceOf(haydenAddress)).to.equal(1);
    expect(await contract.accountTokens(haydenAddress, 0)).to.equal(nftId);

    // add liquidity (one)
    const usdc = await ethers.getContractAt("IERC20", usdcAddress);
    const usdt = await ethers.getContractAt("IERC20", usdtAddress);
    const amount = BigNumber.from("100000000");
    await usdc.connect(haydenSigner).approve(contract.address, amount);
    //await usdt.connect(haydenSigner).approve(contract.address, amount)

    // check autocompound result
    const position = await nonfungiblePositionManager.positions(nftId);
    const [bonus0, bonus1] = await contract.callStatic.autoCompound( { tokenId: nftId, bonusConversion: 0, withdrawBonus: false, doSwap: false })

    const gasCost = await contract.estimateGas.autoCompound( { tokenId: nftId, bonusConversion: 0, withdrawBonus: false, doSwap: false })

    const gasPrice = await ethers.provider.getGasPrice()
    const costETH = parseFloat(ethers.utils.formatEther(gasPrice.mul(gasCost)))

    // simulate cost vs gains
    const tokenPrice0X96 = await getTokenETHPriceX96(factory, position.token0);
    const tokenPrice1X96 = await getTokenETHPriceX96(factory, position.token1);

    // calculate value of collected amounts in ETH
    const valueETHBefore = a0.mul(tokenPrice0X96).div(BigNumber.from(2).pow(96)).add(a1.mul(tokenPrice1X96).div(BigNumber.from(2).pow(96)))

    // check bonus payouts (from owner contract)
    const [bonus0a, bonus1a, comp0a, comp1a] = await contract.callStatic.autoCompound( { tokenId: nftId, bonusConversion: 0, withdrawBonus: false, doSwap: false })
    expect(bonus0a).to.gt(0)
    expect(bonus1a).to.gt(0)
    const [bonus0b, bonus1b, comp0b, comp1b] = await contract.callStatic.autoCompound( { tokenId: nftId, bonusConversion: 1, withdrawBonus: false, doSwap: false })
    expect(bonus0b).to.gt(0)
    expect(bonus1b).to.eq(0)
    const [bonus0c, bonus1c, comp0c, comp1c] = await contract.callStatic.autoCompound( { tokenId: nftId, bonusConversion: 2, withdrawBonus: false, doSwap: false })
    expect(bonus0c).to.eq(0)
    expect(bonus1c).to.gt(0)

    // execute autocompound (from owner contract)
    await contract.autoCompound( { tokenId: nftId, bonusConversion: 0, withdrawBonus: false, doSwap: false })

    // get leftover
    const bh0 = await contract.accountBalances(haydenAddress, usdcAddress);
    const bh1 = await contract.accountBalances(haydenAddress, usdtAddress);

    // get balances from compounder
    const bo0 = await contract.accountBalances(owner.address, usdcAddress);
    const bo1 = await contract.accountBalances(owner.address, usdtAddress);

    // calculate sum of bonus / leftovers / compounded amount in ETH
    const valueETHAfter = bo0.add(comp0a).add(bh0).mul(tokenPrice0X96).div(BigNumber.from(2).pow(96)).add(bo1.add(comp1a).add(bh1).mul(tokenPrice1X96).div(BigNumber.from(2).pow(96)))

    // both values should be very close
    expect(valueETHBefore.mul(1000).div(valueETHAfter)).to.be.within(999, 1001)

    // withdraw bonus 1 by 1
    await contract.withdrawBalance(position.token0, owner.address, bo0)
    await contract.withdrawBalance(position.token1, owner.address, bo1)
    expect(await contract.accountBalances(owner.address, usdcAddress)).to.equal(0);
    expect(await contract.accountBalances(owner.address, usdtAddress)).to.equal(0);

    expect(await usdc.balanceOf(owner.address)).to.gt(0)
    expect(await usdt.balanceOf(owner.address)).to.gt(0)

    // remove token - and remaining balances
    await contract.connect(haydenSigner).withdrawToken(nftId, haydenAddress, true, 0);
    expect(await contract.balanceOf(haydenAddress)).to.equal(0);
    expect(await contract.accountBalances(haydenAddress, usdcAddress)).to.equal(0);
    expect(await contract.accountBalances(haydenAddress, usdtAddress)).to.equal(0);

  });
});

async function getDeadline() {
  return (await ethers.provider.getBlock("latest")).timestamp + 300
}

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