require('dotenv').config()

const { ethers } = require("hardhat");
const hre = require("hardhat");

const CONTRACT_RAW = require("../artifacts/contracts/Contract.sol/Contract.json")
const FACTORY_RAW = require("../artifacts/contracts/external/uniswap/v3-core/interfaces/IUniswapV3Factory.sol/IUniswapV3Factory.json")
const NPM_RAW = require("../artifacts/contracts/external/uniswap/v3-periphery/interfaces/INonfungiblePositionManager.sol/INonfungiblePositionManager.json")

const checkInterval = 5000
const forceCheckInterval = 30 * 60000
const minGainCostPercent = ethers.BigNumber.from(180)

const factoryAddress = "0x1F98431c8aD98523631AE4a59f267346ea31F984"
const npmAddress = "0xC36442b4a4522E871399CD717aBDD847Ab11FE88"

const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL)
const wsProvider = new ethers.providers.WebSocketProvider(process.env.WS_URL)

const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, CONTRACT_RAW.abi, provider)
const factory = new ethers.Contract(factoryAddress, FACTORY_RAW.abi, provider)
const npm = new ethers.Contract(npmAddress, NPM_RAW.abi, provider)

const signer = new hre.ethers.Wallet(process.env.COMPOUNDER_PRIVATE_KEY, hre.ethers.provider)

const trackedPositions = {}

async function trackPositions() {
    const depositedFilter = contract.filters.TokenDeposited()
    const withdrawnFilter = contract.filters.TokenWithdrawn()

    console.log(depositedFilter)

    const deposited = await contract.queryFilter(depositedFilter)
    const withdrawn = await contract.queryFilter(withdrawnFilter)

    const logs = deposited.concat(withdrawn)
    logs.sort((a, b) => a.blockNumber - b.blockNumber)

    for (const log of logs) {
        console.log(log)
        if (log.event == "TokenDeposited") { // TODO check which event
            await addTrackedPosition(log.args.tokenId)
        } else {
            await removeTrackedPosition(log.args.tokenId)
        }
    }

    wsProvider.on(depositedFilter, async (...args) => {
        const event = args[args.length - 1]
        const log = contract.interface.parseLog(event)
        await addTrackedPosition(log.args.tokenId)
    })

    wsProvider.on(withdrawnFilter, async (...args) => {
        const event = args[args.length - 1]
        const log = contract.interface.parseLog(event)
        await removeTrackedPosition(log.args.tokenId)
    })
}

async function addTrackedPosition(nftId) {
    const position = await npm.positions(nftId)
    trackedPositions[nftId] = { nftId, token0: position.token0, token1: position.token1 }
}

async function removeTrackedPosition(nftId) {
    delete trackedPositions[log.args.tokenId]
}

function updateTrackedPosition(nftId, gains, cost) {
    const now = new Date().getTime()
    if (trackedPosition[nftId].lastCheck) {
        const timeElapsedMs = now - trackedPosition[nftId].lastCheck
        trackedPosition[nftId].gainsPerMs = trackedPosition[nftId].lastGains.sub(gain).div(timeElapsedMs)
    }
    trackedPosition[nftId].lastCheck = now
    trackedPosition[nftId].lastGains = gains
    trackedPosition[nftId].lastCost = cost
}

async function getTokenETHPriceX96(address) {
    for (let fee of [100, 500, 3000, 10000]) {
        const poolAddress = await factory.getPool(address, wethAddress, fee);
        if (poolAddress > 0) {
            const poolContract = await ethers.getContractAt("IUniswapV3Pool", poolAddress);
            const isToken1WETH = (await poolContract.token1()).toLowerCase() == wethAddress.toLowerCase();
            const slot0 = await poolContract.slot0()
            return isToken1WETH ? slot0.sqrtPriceX96.pow(2).div(BigNumber.from(2).pow(192 - 96)) : BigNumber.from(2).pow(192 + 96).div(slot0.sqrtPriceX96.pow(2))
        }
    }
}

function isReady(gains, cost) {
    if (gains.mul(100).div(cost).gte(minGainCostPercent)) {
        return true;
    }
}

function needsCheck(trackedPosition, gasPrice) {
    // if it hasnt been checked before
    if (!trackedPosition.lastCheck) {
        return true;
    }

    const timeElapsedMs = new Date().getTime() - trackedPosition.lastCheck
    const estimatedGains = (trackedPosition.gainsPerMs || ethers.BigNumber.from(0)).mul(timeElapsedMs)

    // if its ready with current gas price - check
    if (isReady(trackedPosition.lastGains.add(estimatedGains), gasPrice.mul(trackedPosition.lastCost))) {
        return true;
    }
    // if it hasnt been checked for a long time - check
    if (new Date().getTime() - trackedPosition.lastCheck > forceCheckInterval) {
        return true
    }
    return false;
}

async function autoCompoundPositions() {
    
    let gasPrice = await provider.getGasPrice()

    console.log("Check positions", gasPrice.toString())

    for (const nftId in trackedPositions) {

        const trackedPosition = trackedPositions[nftId]

        if (!needsCheck(trackedPosition, gasPrice)) {
            continue;
        }

        const deadline = Math.floor(new Date().getTime() / 1000) + 300
        const [bonus0, bonus1] = await contract.connect(signer).callStatic.autoCompound( { tokenId: nftId, bonusConversion: 0, withdrawBonus: false, deadline })
        const gasCost = await contract.connect(signer).estimateGas.autoCompound({ tokenId: nftId, bonusConversion: 0, withdrawBonus: false, deadline })
        
        // update gas price to latest
        gasPrice = await provider.getGasPrice()

        const cost = gasPrice.mul(gasCost)

        const tokenPrice0X96 = await getTokenETHPriceX96(position.token0)
        const tokenPrice1X96 = await getTokenETHPriceX96(position.token1)

        const gain0 = bonus0.mul(tokenPrice0X96).div(BigNumber.from(2).pow(96))
        const gain1 = bonus1.mul(tokenPrice1X96).div(BigNumber.from(2).pow(96))
    
        const gains = gain0.add(gain1)

        // TODO reasonable condition
        if (isReady(gains, cost)) {
            const tx = await contract.connect(signer).autoCompound({ tokenId: nftId, bonusConversion: 0, withdrawBonus: false, deadline })
            console.log("Autocompounded position", nftId, tx)
            updateTrackedPosition(nftId, 0, cost)
        } else {
            updateTrackedPosition(nftId, gains, cost)
        }
    }

    setTimeout(async () => { autoCompoundPositions() }, checkInterval);
}

async function run() {
    await trackPositions()
    await autoCompoundPositions()
}

run()