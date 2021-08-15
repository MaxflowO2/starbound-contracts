//SPDX-License-Identifier: MIT

pragma solidity ^0.8.6;

import '@openzeppelin/contracts/utils/math/SafeMath.sol';
import '@openzeppelin/contracts/security/ReentrancyGuard.sol';
import './interfaces/IERC20.sol';
import './interfaces/IShipTicketNFT.sol';
import './interfaces/IShipDividendDistributor.sol';

contract ShipDividendDistributor is IShipDividendDistributor, ReentrancyGuard {
    using SafeMath for uint256;

    uint256 ECONOMY = 0;
    uint256 BUSINESS = 1;

    address _token;

    IERC20 token;
    IShipTicketNFT economyTicketNFT;
    IShipTicketNFT businessTicketNFT;

    struct Share {
        uint256 totalRealised;
        uint256 dividendsDebt;
        bool validated;
    }

    struct ShareInfo {
        uint256 totalShares;
        uint256 totalDividends;
        uint256 totalDistributed;
        uint256 dividendsPerShare;
    }

    mapping(uint256 => Share) public economyShares;
    ShareInfo public economyShareInfo;

    mapping(uint256 => Share) public businessShares;
    ShareInfo public businessShareInfo;

    uint256 public dividendsPerShareAccuracyFactor = 1e6;
    uint256 totalDistributed;

    modifier onlyToken() {
        require(msg.sender == _token);
        _;
    }

    constructor(address _economyTicketNFT, address _businessTicketNFT) {
        _token = msg.sender;

        token = IERC20(_token);
        economyTicketNFT = IShipTicketNFT(_economyTicketNFT);
        businessTicketNFT = IShipTicketNFT(_businessTicketNFT);

        economyShareInfo = ShareInfo({
            totalShares: economyTicketNFT.totalSupply(),
            totalDividends: 0,
            totalDistributed: 0,
            dividendsPerShare: 0
        });
        businessShareInfo = ShareInfo({
            totalShares: businessTicketNFT.totalSupply(),
            totalDividends: 0,
            totalDistributed: 0,
            dividendsPerShare: 0
        });
    }

    function deposit(uint256 _economyAmount, uint256 _businessAmount) external override onlyToken {
        uint256 totalShares;
        uint256 dividendsPerShare;

        if (_economyAmount > 0) {
            totalShares = economyTicketNFT.totalSupply();
            if (totalShares > 0) {
                dividendsPerShare = economyShareInfo.dividendsPerShare.add(
                    _economyAmount.mul(dividendsPerShareAccuracyFactor).div(totalShares)
                );
                economyShareInfo.totalShares = totalShares;
                economyShareInfo.totalDividends = economyShareInfo.totalDividends.add(_economyAmount);
                economyShareInfo.dividendsPerShare = dividendsPerShare;
            }
        }

        if (_businessAmount > 0) {
            totalShares = businessTicketNFT.totalSupply();
            if (totalShares > 0) {
                dividendsPerShare = businessShareInfo.dividendsPerShare.add(
                    _businessAmount.mul(dividendsPerShareAccuracyFactor).div(totalShares)
                );
                businessShareInfo.totalShares = totalShares;
                businessShareInfo.totalDividends = businessShareInfo.totalDividends.add(_businessAmount);
                businessShareInfo.dividendsPerShare = dividendsPerShare;
            }
        }
    }

    function validateEconomyTicket(uint256 ticketId) public {
        require(economyTicketNFT.ownerOf(ticketId) != address(0), 'ShipDividendDistributor: Invalid ticketId');

        if (economyShares[ticketId].validated == true) {
            return;
        }
        economyShares[ticketId].validated = true;
        economyShares[ticketId].dividendsDebt = economyShareInfo.dividendsPerShare;
    }

    function claimEconomyDividend(uint256 ticketId) external nonReentrant {
        require(msg.sender == economyTicketNFT.ownerOf(ticketId), 'ShipDividendDistributor: Invalid ticketId');

        uint256 amount = getEconomyUnpaidEarnings(ticketId);
        if (amount > 0) {
            totalDistributed = totalDistributed.add(amount);
            economyShareInfo.totalDistributed = economyShareInfo.totalDistributed.add(amount);
            economyShares[ticketId].totalRealised = economyShares[ticketId].totalRealised.add(amount);
            economyShares[ticketId].dividendsDebt = economyShareInfo.dividendsPerShare;
            token.transfer(msg.sender, amount);
        }
    }

    function getEconomyUnpaidEarnings(uint256 ticketId) public view returns (uint256) {
        if (economyShares[ticketId].validated != true) {
            return 0;
        }

        return
            economyShareInfo.dividendsPerShare.sub(economyShares[ticketId].dividendsDebt).div(
                dividendsPerShareAccuracyFactor
            );
    }

    function validateBusinessTicket(uint256 ticketId) public {
        require(businessTicketNFT.ownerOf(ticketId) != address(0), 'ShipDividendDistributor: Invalid ticketId');

        if (businessShares[ticketId].validated == true) {
            return;
        }
        businessShares[ticketId].validated = true;
        businessShares[ticketId].dividendsDebt = businessShareInfo.dividendsPerShare;
    }

    function claimBusinessDividend(uint256 ticketId) external nonReentrant {
        require(msg.sender == businessTicketNFT.ownerOf(ticketId), 'ShipDividendDistributor: Invalid ticketId');

        uint256 amount = getBusinessUnpaidEarnings(ticketId);
        if (amount > 0) {
            businessShareInfo.totalDistributed = businessShareInfo.totalDistributed.add(amount);
            businessShares[ticketId].totalRealised = businessShares[ticketId].totalRealised.add(amount);
            businessShares[ticketId].dividendsDebt = businessShareInfo.dividendsPerShare;
            token.transfer(msg.sender, amount);
        }
    }

    function getBusinessUnpaidEarnings(uint256 ticketId) public view returns (uint256) {
        if (businessShares[ticketId].validated != true) {
            return 0;
        }

        return
            businessShareInfo.dividendsPerShare.sub(businessShares[ticketId].dividendsDebt).div(
                dividendsPerShareAccuracyFactor
            );
    }

    function validateTickets() external nonReentrant {
        for (uint256 i = 1; i <= economyTicketNFT.totalSupply(); i++) {
            validateEconomyTicket(i);
        }

        for (uint256 i = 1; i <= businessTicketNFT.totalSupply(); i++) {
            validateBusinessTicket(i);
        }
    }

    function isValidated(uint256 ticketClass, uint256 ticketId) external view returns (bool) {
        if (ticketClass == ECONOMY) {
            return economyShares[ticketId].validated;
        }
        if (ticketId == BUSINESS) {
            return businessShares[ticketId].validated;
        }
        return false;
    }
}
