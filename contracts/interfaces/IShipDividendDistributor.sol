//SPDX-License-Identifier: MIT

pragma solidity ^0.8.6;

interface IShipDividendDistributor {
    function deposit(uint256 economyAmount, uint256 businessAmount) external;
}
