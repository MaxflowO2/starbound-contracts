//SPDX-License-Identifier: MIT

pragma solidity ^0.8.6;

interface IShipTicketNFT {
    function ownerOf(uint256 tokenId) external view returns (address owner);

    function balanceOf(address owner) external view returns (uint256 balance);

    function MintedNFT() external view returns (uint256);

    function checkOwnedTickets() external view returns (uint256[] memory);
}
