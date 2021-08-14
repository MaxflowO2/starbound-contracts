//SPDX-License-Identifier: MIT

pragma solidity ^0.8.6;

interface IShipTicketNFT {
    function ownerOf(uint256 tokenId) external view returns (address owner);
    function balanceOf(address owner) external view returns (uint256 balance);
    function totalSupply() external view returns (uint256);
}
