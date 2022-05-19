// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;
pragma abicoder v2;

import "./external/openzeppelin/token/ERC20/IERC20Metadata.sol";
import "./external/openzeppelin/token/ERC721/IERC721Receiver.sol";

import "./external/uniswap/v3-core/interfaces/IUniswapV3Factory.sol";
import "./external/uniswap/v3-periphery/interfaces/INonfungiblePositionManager.sol";
import "./external/uniswap/v3-periphery/interfaces/ISwapRouter.sol";

interface IContract is IERC721Receiver {
   
    // config changes
    event BonusUpdated(address account, uint64 totalBonusX64, uint64 compounderBonusX64);
    event MinSwapRatioUpdated(address account, uint64 minSwapRatioX64);
    event MaxTWAPTickDifferenceUpdated(address account, uint32 maxTWAPTickDifference);

    // token movements
    event TokenDeposited(address account, uint256 tokenId);
    event TokenWithdrawn(address account, address to, uint256 tokenId);

    // balance movements
    event BalanceWithdrawn(address account, address token, address to, uint256 amount);

    // autocompound event
    event AutoCompounded(
        address account,
        uint256 tokenId,
        uint256 amountAdded0,
        uint256 amountAdded1,
        uint256 bonus0,
        uint256 bonus1
    );

    /// @notice The weth address
    function weth() external view returns (address);

    /// @notice The factory address with which this staking contract is compatible
    function factory() external view returns (IUniswapV3Factory);

    /// @notice The nonfungible position manager address with which this staking contract is compatible
    function nonfungiblePositionManager() external view returns (INonfungiblePositionManager);

    /// @notice The nonfungible position manager address with which this staking contract is compatible
    function swapRouter() external view returns (ISwapRouter);

    /// @notice Owner of a managed NFT
    function ownerOf(uint256 tokenId) external view returns (address owner);

    /**
     * @notice Returns amount of NFTs for a given account
     * @param account Address of account
     * @return balance amount of NFTs for account
     */
    function balanceOf(address account) external view returns (uint256 balance);

    /**
     * @notice Returns balance of token of account
     * @param account Address of account
     * @param token Address of token
     * @return balance amount of token for account
     */
    function accountBalances(address account, address token) external view returns (uint256 balance);

    /**
     * @notice Removes a NFT from the protocol and safe transfers it to address to
     * @param tokenId TokenId of token to remove
     * @param to Address to send to
     * @param data data which is sent with the safeTransferFrom call (optional)
     * @param withdrawBalances When true sends the available balances for token0 and token1 as well
     */
    function withdrawToken(
        uint256 tokenId,
        address to,
        bytes memory data,
        bool withdrawBalances
    ) external;

    /**
     * @notice Withdraws token balance for a address and token
     * @param token Address of token to withdraw
     * @param to Address to send to
     * @param amount amount to withdraw
     */
    function withdrawBalance(address token, address to, uint256 amount) external;

    /// @notice how bonus should be converted
    enum BonusConversion { NONE, TOKEN_0, TOKEN_1 }

    /// @notice params for autoCompound()
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

    /**
     * @notice Autocompounds for a given NFT (anyone can call this and gets a percentage of the fees)
     * @param params Autocompound specific parameters (tokenId, ...)
     * @return bonus0 Amount of token0 caller recieves
     * @return bonus1 Amount of token1 caller recieves
     * @return compounded0 Amount of token0 that was compounded
     * @return compounded1 Amount of token1 that was compounded
     */
    function autoCompound(AutoCompoundParams calldata params) external returns (uint256 bonus0, uint256 bonus1, uint256 compounded0, uint256 compounded1);

    /// @notice params for swapAndMint()
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
    
    /**
     * @notice Creates new position (for a already existing pool) swapping to correct ratio and adds it to be autocompounded
     * @param params Specifies details for position to create and how much of each token is provided (ETH is automatically wrapped)
     * @return tokenId tokenId of created position
     * @return liquidity amount of liquidity added
     * @return amount0 amount of token0 added
     * @return amount1 amount of token1 added
     */
    function swapAndMint(SwapAndMintParams calldata params)
        external
        payable
        returns (
            uint256 tokenId,
            uint128 liquidity,
            uint256 amount0,
            uint256 amount1
        );

    /// @notice params for swapAndIncreaseLiquidity()
    struct SwapAndIncreaseLiquidityParams {
        uint256 tokenId;
        uint256 amount0;
        uint256 amount1;
        uint256 deadline;
    }

    /**
     * @notice Increase liquidity in the correct ratio
     * @param params Specifies tokenId and much of each token is provided (ETH is automatically wrapped)
     * @return liquidity amount of liquidity added
     * @return amount0 amount of token0 added
     * @return amount1 amount of token1 added
     */
    function swapAndIncreaseLiquidity(SwapAndIncreaseLiquidityParams calldata params)
        external
        payable
        returns (
            uint128 liquidity,
            uint256 amount0,
            uint256 amount1
        );

    struct DecreaseLiquidityAndCollectParams {
        uint256 tokenId;
        uint128 liquidity;
        uint256 amount0Min;
        uint256 amount1Min;
        uint256 deadline;
        address recipient;
    }

    /**
     * @notice Special method to decrease liquidity and collect decreased amount - can only be called by the NFT owner
     * @dev Needs to do collect at the same time, otherwise the available amount would be autocompoundable for other positions
     * @param params DecreaseLiquidityAndCollectParams which are forwarded to the Uniswap V3 NonfungiblePositionManager
     * @return amount0 amount of token0 removed and collected
     * @return amount1 amount of token1 removed and collected
     */
    function decreaseLiquidityAndCollect(DecreaseLiquidityAndCollectParams calldata params)
        external
        payable
        returns (uint256 amount0, uint256 amount1);

    /**
     * @notice Forwards collect call to NonfungiblePositionManager - can only be called by the NFT owner
     * @param params INonfungiblePositionManager.CollectParams which are forwarded to the Uniswap V3 NonfungiblePositionManager
     * @return amount0 amount of token0 collected
     * @return amount1 amount of token1 collected
     */
    function collect(INonfungiblePositionManager.CollectParams calldata params) external payable returns (uint256 amount0, uint256 amount1);
}