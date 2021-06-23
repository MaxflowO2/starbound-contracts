//SPDX-License-Identifier: Unlicense
pragma solidity ^0.7.6;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/IPancakeFactory.sol";
import "../interfaces/IPancakeRouter02.sol";
import "../libraries/TransferHelper.sol";
import "../libraries/Whitelistable.sol";

contract StarboundPrivateSale is Ownable, Whitelistable {
    using SafeMath for uint256;

    event TokensPurchased(address indexed buyer, uint256 indexed amount);
    event TokensClaimed(address indexed buyer, uint256 indexed amount);
    event TokensReleased(address indexed buyer, uint256 indexed amount);
    event LiquidityMigrated(uint256 amountToken, uint256 amountETH, uint256 liquidity);
    event SaleClosed();

    address public constant ZERO_ADDRESS = address(0);
    uint256 public priceFairLaunch;
    uint256 public pricePancakeswap;
    IPancakeFactory public pancakeFactory;
    IPancakeRouter02 public pancakeRouter;
    address public tokenOut;
    uint256 public startDate;
    uint256 public endDate;
    uint256 public unlockDate;
    uint256 public minCommitment;
    uint256 public maxCommitment;
    uint256 public softCap;
    uint256 public hardCap;
    uint256 public tokensSold;
    bool public isClosed;
    bool public liquidityMigrated;
    address public tokenContract;

    mapping(address => uint256) public tokensPurchased;

    /**
     * @dev Restricts access to a time between the startDate and the endDate.
     *
     */
    modifier isActive() {
        require(block.timestamp > startDate, "StarboundPrivateSale: too early!");
        require(block.timestamp < endDate, "StarboundPrivateSale: too late!");
        _;
    }

    /**
     * @dev Restricts token release functions until lockdate is reached
     *
     */
    modifier tokensUnlocked() {
        require(block.timestamp > unlockDate, "StarboundPrivateSale: tokens not unlocked yet");
        _;
    }

    constructor(
        uint256 _startDate,
        uint256 _endDate,
        uint256 _unlockDate,
        uint256 _minCommitment,
        uint256 _maxCommitment,
        uint256 _softCap,
        uint256 _hardCap,
        address _tokenOut,
        address _pancakeRouter,
        address _pancakeFactory,
        uint256 _priceFairLaunch,
        uint256 _pricePancakeswap
    ) public {
        require(_softCap < _hardCap, "StarboundPrivateSale: softCap cannot be higher then hardCap");
        require(_startDate < _endDate, "StarboundPrivateSale: startDate cannot be after endDate");
        require(_endDate > block.timestamp, "StarboundPrivateSale: endDate must be in the future");
        require(_minCommitment < _maxCommitment, "StarboundPrivateSale: minCommitment cannot be higher then maxCommitment");
        require(_pricePancakeswap < _priceFairLaunch, "StarboundPrivateSale: pancakeswap price cannot be lower then fairlaunch");
        require(_unlockDate > _endDate || _unlockDate == 0, "StarboundPrivateSale: invalid unlockDate");

        startDate = _startDate;
        endDate = _endDate;
        unlockDate = _unlockDate;
        minCommitment = _minCommitment;
        maxCommitment = _maxCommitment;
        softCap = _softCap;
        hardCap = _hardCap;
        tokenOut = _tokenOut;
        pancakeRouter = IPancakeRouter02(_pancakeRouter);
        pancakeFactory = IPancakeFactory(_pancakeFactory);
        priceFairLaunch = _priceFairLaunch;
        pricePancakeswap = _pricePancakeswap;
    }

    /**
     * @dev purchase tokens for a fixed price
     *
     */
    function purchaseTokens() external payable isActive onlyWhitelist {
        uint256 amount = msg.value;
        require(!isClosed, "StarboundPrivateSale: sale closed");
        require(amount >= minCommitment, "StarboundPrivateSale: amount to low");
        require(tokensPurchased[msg.sender].add(amount) <= maxCommitment, "StarboundPrivateSale: maxCommitment reached");
        require(tokensSold.add(amount) <= hardCap, "StarboundPrivateSale: hardcap reached");

        tokensSold = tokensSold.add(amount);
        tokensPurchased[msg.sender] = tokensPurchased[msg.sender].add(amount);
        emit TokensPurchased(msg.sender, amount);
    }

    /**
     * @dev close sale if minRaise is reached & migrates liquidity to Pancake
     *
     */
    function closeSale() external tokensUnlocked {
        require(!isClosed, "StarboundPrivateSale: already closed");
        require(block.timestamp > endDate || tokensSold == hardCap, "StarboundPrivateSale: endDate not passed or hardcap not reached");
        require(tokensSold >= softCap, "StarboundPrivateSale: softCap not reached");
        isClosed = true;

        emit SaleClosed();
    }

    /**
     * @dev let investors claim their purchased tokens
     *
     */
    function claimTokens() external tokensUnlocked {
        require(isClosed, "StarboundPrivateSale: sale not closed");
        require(tokensPurchased[msg.sender] > 0, "StarboundPrivateSale: no tokens to claim");
        uint256 purchasedTokens = tokensPurchased[msg.sender].mul(priceFairLaunch).div(10**9);
        tokensPurchased[msg.sender] = 0;
        TransferHelper.safeTransfer(address(tokenOut), msg.sender, purchasedTokens);
        emit TokensClaimed(msg.sender, purchasedTokens);
    }

    /**
     * @dev realease tokenIn back to investors if softCap not reached
     *
     */
    function releaseTokens() external tokensUnlocked {
        require(!isClosed, "StarboundPrivateSale: cannot release tokens for closed sale");
        require(softCap > 0, "StarboundPrivateSale: no softCap");
        require(block.timestamp > endDate, "StarboundPrivateSale: endDate not passed");
        require(tokensPurchased[msg.sender] > 0, "StarboundPrivateSale: no tokens to release");
        require(tokensSold < softCap, "StarboundPrivateSale: softCap reached");

        uint256 purchasedTokens = tokensPurchased[msg.sender];
        tokensPurchased[msg.sender] = 0;
        TransferHelper.safeTransferETH(msg.sender, purchasedTokens);
        emit TokensReleased(msg.sender, purchasedTokens);
    }

    /**
     * @dev to get remaining token at any point of the sale
     *
     */
    function tokensRemaining() external view returns (uint256) {
        return (hardCap.sub(tokensSold).mul(priceFairLaunch).div(10**9));
    }

    /**
     * @dev Returns the time left to endDate in seconds.
     *
     */
    function getTimeLeftEndDate() external view returns (uint256) {
        if (block.timestamp > endDate) {
            return 0;
        } else {
            return endDate.sub(block.timestamp);
        }
    }

    /**
     * @dev Returns the time left to unlockDate in seconds.
     *
     */
    function getTimeLeftUnlockDate() external view returns (uint256) {
        if (block.timestamp > unlockDate) {
            return 0;
        } else {
            return unlockDate.sub(block.timestamp);
        }
    }

    function getReservedTokens() external view returns (uint256) {
        tokensPurchased[msg.sender] > 0 ? tokensPurchased[msg.sender].mul(priceFairLaunch).div(10**9) : 0;
    }

    /**
     * @dev Withdraw BNB that somehow ended up in the contract.
     *
     */
    function withdrawBnb() external onlyOwner tokensUnlocked {
        _msgSender().transfer(address(this).balance);
    }

    /**
     * @dev Withdraw any erc20 compliant tokens that
     * somehow ended up in the contract.
     *
     */
    function withdrawErc20Token(
        address token,
        address to,
        uint256 amount
    ) external onlyOwner tokensUnlocked {
        IERC20(token).transfer(to, amount);
    }

    receive() external payable {}
}