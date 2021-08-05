//SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.6;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/utils/math/SafeMath.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
import './libraries/TransferHelper.sol';
import './libraries/Whitelistable.sol';

contract StarboundPrivateSale is Ownable, Whitelistable {
    using SafeMath for uint256;

    event TokensPurchased(address indexed buyer, uint256 indexed amount);
    event TokensClaimed(address indexed buyer, uint256 indexed amount);
    event TokensReleased(address indexed buyer, uint256 indexed amount);
    event SaleClosed();

    address public constant ZERO_ADDRESS = address(0);
    uint256 public pricePresale;
    address public tokenOut;
    uint256 public startDate;
    uint256 public endDate;
    uint256 public minCommitment;
    uint256 public maxCommitment;
    uint256 public softCap;
    uint256 public hardCap;
    uint256 public tokensSold;
    bool public isClosed;
    address public tokenContract;

    mapping(address => uint256) public tokensPurchased;

    /**
     * @dev Restricts access to a time between the startDate and the endDate.
     *
     */
    modifier isActive() {
        require(block.timestamp > startDate, 'StarboundPrivateSale: too early!');
        require(block.timestamp < endDate, 'StarboundPrivateSale: too late!');
        _;
    }

    constructor(
        uint256 _startDate,
        uint256 _endDate,
        uint256 _minCommitment,
        uint256 _maxCommitment,
        uint256 _softCap,
        uint256 _hardCap,
        address _tokenOut,
        uint256 _pricePresale
    ) public {
        require(_softCap < _hardCap, 'StarboundPrivateSale: softCap cannot be higher than hardCap');
        require(_startDate < _endDate, 'StarboundPrivateSale: startDate cannot be after endDate');
        require(_endDate > block.timestamp, 'StarboundPrivateSale: endDate must be in the future');
        require(_minCommitment > 0, 'StarboundPrivateSale: minCommitment must be higher than 0');
        require(
            _minCommitment < _maxCommitment,
            'StarboundPrivateSale: minCommitment cannot be higher than maxCommitment'
        );

        startDate = _startDate;
        endDate = _endDate;
        minCommitment = _minCommitment;
        maxCommitment = _maxCommitment;
        softCap = _softCap;
        hardCap = _hardCap;
        tokenOut = _tokenOut;
        pricePresale = _pricePresale;
    }

    /**
     * @dev purchase tokens for a fixed price
     *
     */
    function purchaseTokens() external payable isActive onlyWhitelist {
        require(!isClosed, 'StarboundPrivateSale: sale closed');
        uint256 amount = msg.value;
        require(amount >= minCommitment, 'StarboundPrivateSale: amount too low');
        require(
            tokensPurchased[msg.sender].add(amount) <= maxCommitment,
            'StarboundPrivateSale: maxCommitment reached'
        );
        require(tokensSold.add(amount) <= hardCap, 'StarboundPrivateSale: hardcap reached');

        tokensSold = tokensSold.add(amount);
        tokensPurchased[msg.sender] = tokensPurchased[msg.sender].add(amount);
        emit TokensPurchased(msg.sender, amount);
    }

    /**
     * @dev close sale if minRaise is reached
     *
     */
    function closeSale() external onlyOwner {
        require(!isClosed, 'StarboundPrivateSale: already closed');
        require(
            block.timestamp > endDate || tokensSold == hardCap,
            'StarboundPrivateSale: endDate not passed or hardcap not reached'
        );
        require(tokensSold >= softCap, 'StarboundPrivateSale: softCap not reached');
        isClosed = true;

        emit SaleClosed();
    }

    function setTokenOut(address _tokenOut) external onlyOwner {
        tokenOut = _tokenOut;
    }

    function setPricePresale(uint256 _pricePresale) external onlyOwner {
        require(_pricePresale > 0, 'StarboundPrivateSale: pricePresale must be positive');
        pricePresale = _pricePresale;
    }

    function setStartDate(uint256 _startDate) external onlyOwner {
        require(_startDate < endDate, 'StarboundPrivateSale: invalid startDate');
        startDate = _startDate;
    }

    function setEndDate(uint256 _endDate) external onlyOwner {
        require(_endDate > startDate, 'StarboundPrivateSale: invalid endDate');
        endDate = _endDate;
    }

    /**
     * @dev let investors claim their purchased tokens
     *
     */
    function claimTokens() external {
        require(isClosed, 'StarboundPrivateSale: sale not closed');
        require(tokensPurchased[msg.sender] > 0, 'StarboundPrivateSale: no tokens to claim');
        uint256 purchasedTokens = tokensPurchased[msg.sender].mul(pricePresale).div(10**9);
        tokensPurchased[msg.sender] = 0;
        TransferHelper.safeTransfer(address(tokenOut), msg.sender, purchasedTokens);
        emit TokensClaimed(msg.sender, purchasedTokens);
    }

    /**
     * @dev realease tokenIn back to investors if softCap not reached
     *
     */
    function releaseTokens() external {
        require(!isClosed, 'StarboundPrivateSale: cannot release tokens for closed sale');
        require(softCap > 0, 'StarboundPrivateSale: no softCap');
        require(block.timestamp > endDate, 'StarboundPrivateSale: endDate not passed');
        require(tokensPurchased[msg.sender] > 0, 'StarboundPrivateSale: no tokens to release');
        require(tokensSold < softCap, 'StarboundPrivateSale: softCap reached');

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
        return (hardCap.sub(tokensSold).mul(pricePresale).div(10**9));
    }

    /**
     * @dev to get remaining token at any point of the sale
     *
     */
    function bnbRemaining() external view returns (uint256) {
        return hardCap.sub(tokensSold);
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

    function getReservedTokens() external view returns (uint256) {
        if (tokensPurchased[msg.sender] > 0) {
            return tokensPurchased[msg.sender].mul(pricePresale).div(10**9);
        } else {
            return 0;
        }
    }

    /**
     * @dev Withdraw BNB that somehow ended up in the contract.
     *
     */
    function withdrawBnb() external onlyOwner {
        payable(_msgSender()).transfer(address(this).balance);
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
    ) external onlyOwner {
        IERC20(token).transfer(to, amount);
    }

    receive() external payable {}
}
