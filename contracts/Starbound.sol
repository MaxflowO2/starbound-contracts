//SPDX-License-Identifier: MIT

pragma solidity ^0.8.6;

/*
 *  $$$$$$\ $$$$$$$$\  $$$$$$\  $$$$$$$\  $$$$$$$\   $$$$$$\  $$\   $$\ $$\   $$\ $$$$$$$\
 * $$  __$$\\__$$  __|$$  __$$\ $$  __$$\ $$  __$$\ $$  __$$\ $$ |  $$ |$$$\  $$ |$$  __$$\
 * $$ /  \__|  $$ |   $$ /  $$ |$$ |  $$ |$$ |  $$ |$$ /  $$ |$$ |  $$ |$$$$\ $$ |$$ |  $$ |
 * \$$$$$$\    $$ |   $$$$$$$$ |$$$$$$$  |$$$$$$$\ |$$ |  $$ |$$ |  $$ |$$ $$\$$ |$$ |  $$ |
 *  \____$$\   $$ |   $$  __$$ |$$  __$$< $$  __$$\ $$ |  $$ |$$ |  $$ |$$ \$$$$ |$$ |  $$ |
 * $$\   $$ |  $$ |   $$ |  $$ |$$ |  $$ |$$ |  $$ |$$ |  $$ |$$ |  $$ |$$ |\$$$ |$$ |  $$ |
 * \$$$$$$  |  $$ |   $$ |  $$ |$$ |  $$ |$$$$$$$  | $$$$$$  |\$$$$$$  |$$ | \$$ |$$$$$$$  |
 *  \______/   \__|   \__|  \__|\__|  \__|\_______/  \______/  \______/ \__|  \__|\_______/
 *
 *  https://starboundfinance.com/
 *  https://t.me/StarboundOfficial
 */

import '@openzeppelin/contracts/utils/math/SafeMath.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
import './libraries/TransferHelper.sol';
import './interfaces/IERC20.sol';
import './interfaces/IDEXFactory.sol';
import './interfaces/IDEXRouter.sol';
import './DividendDistributor.sol';
import './ShipDividendDistributor.sol';

contract Starbound is Context, Ownable, IERC20 {
    using SafeMath for uint256;

    address private constant WBNB = 0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c;
    address private constant DEAD = 0x000000000000000000000000000000000000dEaD;
    address private constant ZERO = address(0);
    address private constant ECONOMY_TICKET = address(0);
    address private constant BUSINESS_TICKET = address(0);

    string constant _name = "Starbound";
    string constant _symbol = "SBD";
    uint8 constant _decimals = 9;
    uint256 _totalSupply = 1000000000 * (10 ** _decimals); // 1,000,000,000
    mapping (address => uint256) _balances;
    mapping (address => mapping (address => uint256)) _allowances;

    mapping (address => bool) public isFeeExempt;
    mapping (address => bool) public isTxLimitExempt;
    mapping (address => bool) public isDividendExempt;
    mapping (address => bool) public isBlacklisted;

    uint256 public _maxTxAmount = _totalSupply / 2000; // 0.05%

    uint256 private feeDenominator = 10000;
    uint256 private reflectionFee = 500;
    uint256 private marketingFee = 300;
    uint256 private economyTicketFee = 50;
    uint256 private businessTicketFee = 50;
    uint256 public totalFee = 900;

    address public marketingFeeReceiver;

    IDEXRouter public router;
    address public pair;

    uint256 public launchedAt;

    uint256 public feeExemptStartAt;
    uint256 public feeExemptLength = 60 minutes;

    DividendDistributor public distributor;
    uint256 private distributorGas = 500000;

    ShipDividendDistributor public shipDistributor;

    bool public swapEnabled = true;
    uint256 public swapThreshold = _totalSupply / 20000; // 0.005%
    bool inSwap;
    modifier swapping() {
        inSwap = true;
        _;
        inSwap = false;
    }

    constructor(address[] memory _presaleContracts) {
        // PancakeswapRouter mainnet
        router = IDEXRouter(0x10ED43C718714eb63d5aA57B78B54704E256024E);
        pair = IDEXFactory(router.factory()).createPair(WBNB, address(this));
        _allowances[address(this)][address(router)] = type(uint256).max;

        distributor = new DividendDistributor();
        shipDistributor = new ShipDividendDistributor(ECONOMY_TICKET, BUSINESS_TICKET);

        isFeeExempt[msg.sender] = true;
        isTxLimitExempt[msg.sender] = true;

        for (uint256 i=0; i < _presaleContracts.length; i++) {
            isFeeExempt[_presaleContracts[i]] = true;
            isTxLimitExempt[_presaleContracts[i]] = true;
            isDividendExempt[_presaleContracts[i]] = true;
        }

        isDividendExempt[pair] = true;
        isDividendExempt[address(this)] = true;
        isDividendExempt[DEAD] = true;
        isDividendExempt[ZERO] = true;

        marketingFeeReceiver = msg.sender;

        _balances[msg.sender] = _totalSupply;
        emit Transfer(ZERO, msg.sender, _totalSupply);
    }

    receive() external payable { }

    function totalSupply() external view override returns (uint256) { return _totalSupply; }
    function decimals() external pure override returns (uint8) { return _decimals; }
    function symbol() external pure override returns (string memory) { return _symbol; }
    function name() external pure override returns (string memory) { return _name; }
    function balanceOf(address account) public view override returns (uint256) { return _balances[account]; }
    function allowance(address holder, address spender) external view override returns (uint256) { return _allowances[holder][spender]; }

    function approve(address spender, uint256 amount) public override returns (bool) {
        _allowances[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function approveMax(address spender) external returns (bool) {
        return approve(spender, type(uint256).max);
    }

    function transfer(address recipient, uint256 amount) external override returns (bool) {
        return _transferFrom(msg.sender, recipient, amount);
    }

    function transferFrom(address sender, address recipient, uint256 amount) external override returns (bool) {
        if(_allowances[sender][msg.sender] != type(uint256).max){
            _allowances[sender][msg.sender] = _allowances[sender][msg.sender].sub(amount, "Insufficient Allowance");
        }

        return _transferFrom(sender, recipient, amount);
    }

    function _transferFrom(address sender, address recipient, uint256 amount) internal returns (bool) {
        require(!isBlacklisted[sender] && !isBlacklisted[recipient], "BLACKLISTED!");

        if (inSwap) {
            return _basicTransfer(sender, recipient, amount);
        }

        checkTxLimit(sender, amount);

        if (shouldSwapBack()) {
            swapBack();
        }

        if (!launched() && recipient == pair) {
            require(_balances[sender] > 0);
            launch();
        }

        _balances[sender] = _balances[sender].sub(amount, "Insufficient Balance");

        uint256 amountReceived = shouldTakeFee(sender) ? takeFee(sender, amount) : amount;
        _balances[recipient] = _balances[recipient].add(amountReceived);

        if (!isDividendExempt[sender]) { try distributor.setShare(sender, _balances[sender]) {} catch {} }
        if (!isDividendExempt[recipient]) { try distributor.setShare(recipient, _balances[recipient]) {} catch {} }

        try distributor.process(distributorGas) {} catch {}

        emit Transfer(sender, recipient, amountReceived);
        return true;
    }

    function _basicTransfer(address sender, address recipient, uint256 amount) internal returns (bool) {
        _balances[sender] = _balances[sender].sub(amount, "Insufficient Balance");
        _balances[recipient] = _balances[recipient].add(amount);
        emit Transfer(sender, recipient, amount);
        return true;
    }

    function checkTxLimit(address sender, uint256 amount) internal view {
        require(amount <= _maxTxAmount || isTxLimitExempt[sender], "TX Limit Exceeded");
    }

    function shouldTakeFee(address sender) internal view returns (bool) {
        return !isFeeExempt[sender];
    }

    function getTicketFee() public view returns (uint256) {
        return economyTicketFee.add(businessTicketFee);
    }

    function getTotalFee(bool buying) public view returns (uint256) {
        if(buying && feeExemptStartAt.add(feeExemptLength) > block.timestamp) {
            return getTicketFee();
        }
        return totalFee;
    }

    function takeFee(address sender, uint256 amount) internal returns (uint256) {
        // take bnb fee
        // take 
        uint256 economyTicketFeeAmount = amount.mul(economyTicketFee).div(feeDenominator);
        uint256 businessTicketFeeAmount = amount.mul(businessTicketFee).div(feeDenominator);
        uint256 ticketFeeAmount = economyTicketFeeAmount.add(businessTicketFeeAmount);
        uint256 feeAmount = amount.mul(getTotalFee(sender == pair)).div(feeDenominator);

        if (ticketFeeAmount >= feeAmount) {
            feeAmount = 0;
        }

        _balances[address(shipDistributor)] = _balances[address(shipDistributor)].add(ticketFeeAmount);
        emit Transfer(sender, address(shipDistributor), ticketFeeAmount);
        shipDistributor.deposit(economyTicketFeeAmount, businessTicketFeeAmount);

        if (feeAmount > 0) {
            _balances[address(this)] = _balances[address(this)].add(feeAmount);
            emit Transfer(sender, address(this), feeAmount);
        }

        return amount.sub(feeAmount);
    }

    function shouldSwapBack() internal view returns (bool) {
        return msg.sender != pair
        && !inSwap
        && swapEnabled
        && _balances[address(this)] >= swapThreshold;
    }

    function swapBack() internal swapping {
        uint256 amountToSwap = swapThreshold;

        address[] memory path = new address[](2);
        path[0] = address(this);
        path[1] = WBNB;

        uint256 balanceBefore = address(this).balance;

        router.swapExactTokensForETHSupportingFeeOnTransferTokens(
            amountToSwap,
            0,
            path,
            address(this),
            block.timestamp
        );

        uint256 amountBNB = address(this).balance.sub(balanceBefore);

        uint256 totalBNBFee = totalFee;
        uint256 amountBNBReflection = amountBNB.mul(reflectionFee).div(totalBNBFee);
        uint256 amountBNBMarketing = amountBNB.mul(marketingFee).div(totalBNBFee);

        try distributor.deposit{value: amountBNBReflection}() {} catch {}
        TransferHelper.safeTransferETH(marketingFeeReceiver, amountBNBMarketing);
    }

    function launched() internal view returns (bool) {
        return launchedAt != 0;
    }

    function launch() internal {
        launchedAt = block.number;
    }

    function setTxLimit(uint256 amount) external onlyOwner {
        require(amount >= _totalSupply / 2000);
        _maxTxAmount = amount;
    }

    function setIsDividendExempt(address holder, bool exempt) external onlyOwner {
        require(holder != address(this) && holder != pair);
        isDividendExempt[holder] = exempt;
        if (exempt) {
            distributor.setShare(holder, 0);
        } else {
            distributor.setShare(holder, _balances[holder]);
        }
    }

    function setIsFeeExempt(address holder, bool exempt) external onlyOwner {
        isFeeExempt[holder] = exempt;
    }

    function setIsTxLimitExempt(address holder, bool exempt) external onlyOwner {
        isTxLimitExempt[holder] = exempt;
    }

    function setIsBlacklisted(address holder, bool blacklisted) external onlyOwner {
        isBlacklisted[holder] = blacklisted;
    }

    function setFees(
        uint256 _reflectionFee,
        uint256 _marketingFee,
        uint256 _economyTicketFee,
        uint256 _businessTicketFee,
        uint256 _feeDenominator
    ) external onlyOwner {
        reflectionFee = _reflectionFee;
        marketingFee = _marketingFee;
        economyTicketFee = _economyTicketFee;
        businessTicketFee = _businessTicketFee;
        totalFee = _reflectionFee
            .add(_marketingFee)
            .add(_economyTicketFee)
            .add(_businessTicketFee);
        feeDenominator = _feeDenominator;
        require(totalFee < feeDenominator/5);
    }

    function setFeeReceivers(address _marketingFeeReceiver) external onlyOwner {
        marketingFeeReceiver = _marketingFeeReceiver;
    }

    function setSwapBackSettings(bool _enabled, uint256 _amount) external onlyOwner {
        swapEnabled = _enabled;
        swapThreshold = _amount;
    }

    function setDistributionCriteria(uint256 _minPeriod, uint256 _minDistribution) external onlyOwner {
        distributor.setDistributionCriteria(_minPeriod, _minDistribution);
    }

    function setDistributorSettings(uint256 gas) external onlyOwner {
        require(gas < 750000);
        distributorGas = gas;
    }

    function setFeeExemptSettings(uint256 startAt, uint256 length) external onlyOwner {
        require(startAt > block.timestamp);
        feeExemptStartAt = startAt;
        feeExemptLength = length;
    }

    function clearFeeExempt() external onlyOwner {
        feeExemptStartAt = 0;
    }
}
