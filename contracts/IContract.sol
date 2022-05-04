// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;
pragma abicoder v2;

import "./external/openzeppelin/token/ERC20/IERC20Metadata.sol";
import "./external/openzeppelin/token/ERC721/IERC721Receiver.sol";

import "./external/uniswap/v3-core/interfaces/IUniswapV3Factory.sol";
import "./external/uniswap/v3-periphery/interfaces/INonfungiblePositionManager.sol";
import "./external/uniswap/v3-periphery/interfaces/ISwapRouter.sol";

interface IContract is IERC721Receiver {
   
    event BonusUpdated(address account, uint64 totalBonusX64, uint64 compounderBonusX64);

    event MinSwapRatioUpdated(address account, uint64 minSwapRatioX64);

    event TokenDeposited(address account, uint256 tokenId);

    event TokenWithdrawn(address account, address to, uint256 tokenId);

    event BalanceWithdrawn(address account, address token, address to, uint256 amount);

    event AutoCompounded(
        address account,
        uint256 tokenId,
        uint256 amountDeposited0,
        uint256 amountDeposited1,
        uint256 amountReturned0,
        uint256 amountReturned1
    );

    /// @notice The weth address
    function weth() external view returns (address);

    /// @notice The factory address with which this staking contract is compatible
    function factory() external view returns (IUniswapV3Factory);

    /// @notice The nonfungible position manager address with which this staking contract is compatible
    function nonfungiblePositionManager() external view returns (INonfungiblePositionManager);

    /// @notice The nonfungible position manager address with which this staking contract is compatible
    function swapRouter() external view returns (ISwapRouter);

    /// @notice Returns the owner of the deposited NFT
    function ownerOf(uint256 tokenId) external view returns (address owner);

    // @notice Number of deposited tokens of account
    function balanceOf(address account) external view returns (uint256 length);

    /// @notice Withdraws a Uniswap V3 LP token `tokenId` from this contract to the recipient `to`
    /// @param tokenId The unique identifier of an Uniswap V3 LP token
    /// @param to The address where the LP token will be sent
    /// @param data An optional data array that will be passed along to the `to` address via the NFT safeTransferFrom
    function withdrawToken(
        uint256 tokenId,
        address to,
        bytes memory data,
        bool withdrawBalances
    ) external;

    // how bonus should be converted
    enum BonusConversion { NONE, TOKEN_0, TOKEN_1 }

    struct AutoCompoundParams {
        // tokenid to autocompound
        uint256 tokenId;
        
        // which token to convert to
        BonusConversion bonusConversion;

        // should token be withdrawn to compounder immediately
        bool withdrawBonus;

        // for swap / add liquidity operations
        uint256 deadline;
    }

    // automatically compound fees back into range
    /// @return bonus0 The amount of token0 you get as a bonus for autocompounding
    /// @return bonus1 The amount of token1 you get as a bonus for autocompounding
    function autoCompound(AutoCompoundParams calldata params) external returns (uint256 bonus0, uint256 bonus1);

    struct SwapAndMintParams {
        address token0;
        address token1;
        uint24 fee;
        int24 tickLower;
        int24 tickUpper;
        uint256 amount0;
        uint256 amount1;
        address recipient;
        uint256 deadline;
    }
    
    /// @notice Creates a new position wrapped in a NFT - swaps to the correct ratio and adds it to be autocompounded
    /// @dev Call this when the pool does exist and is initialized. Note that if the pool is created but not initialized
    /// a method does not exist, i.e. the pool is assumed to be initialized.
    /// @param params The params necessary to mint a position, encoded as `MintParams` in calldata
    /// @return tokenId The ID of the token that represents the minted position
    /// @return liquidity The amount of liquidity for this position
    /// @return amount0 The amount of token0
    /// @return amount1 The amount of token1
    function swapAndMint(SwapAndMintParams calldata params)
        external
        payable
        returns (
            uint256 tokenId,
            uint128 liquidity,
            uint256 amount0,
            uint256 amount1
        );

    struct SwapAndIncreaseLiquidityParams {
        uint256 tokenId;
        uint256 amount0;
        uint256 amount1;
        uint256 deadline;
    }

    /// @notice Swaps to the correct ratio and adds liquidity to a position
    /// @param params The params necessary to mint a position, encoded as `SwapAndIncreaseLiquidityParams` in calldata
    /// @return liquidity The amount of liquidity for this position
    /// @return amount0 The amount of token0
    /// @return amount1 The amount of token1
    function swapAndIncreaseLiquidity(SwapAndIncreaseLiquidityParams calldata params)
        external
        payable
        returns (
            uint128 liquidity,
            uint256 amount0,
            uint256 amount1
        );

    /// @notice Decreases the amount of liquidity in a position and accounts it to the position
    /// @param params tokenId The ID of the token for which liquidity is being decreased,
    /// amount The amount by which liquidity will be decreased,
    /// amount0Min The minimum amount of token0 that should be accounted for the burned liquidity,
    /// amount1Min The minimum amount of token1 that should be accounted for the burned liquidity,
    /// deadline The time by which the transaction must be included to effect the change
    /// @return amount0 The amount of token0 accounted to the position's tokens owed
    /// @return amount1 The amount of token1 accounted to the position's tokens owed
    function decreaseLiquidityAndCollect(INonfungiblePositionManager.DecreaseLiquidityParams calldata params, address recipient)
        external
        payable
        returns (uint256 amount0, uint256 amount1);

    /// @notice Collects up to a maximum amount of fees owed to a specific position to the recipient
    /// @param params tokenId The ID of the NFT for which tokens are being collected,
    /// recipient The account that should receive the tokens,
    /// amount0Max The maximum amount of token0 to collect,
    /// amount1Max The maximum amount of token1 to collect
    /// @return amount0 The amount of fees collected in token0
    /// @return amount1 The amount of fees collected in token1
    function collect(INonfungiblePositionManager.CollectParams calldata params) external payable returns (uint256 amount0, uint256 amount1);
}