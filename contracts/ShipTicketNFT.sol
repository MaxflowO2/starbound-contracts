//SPDX-License-Identifier: MIT

pragma solidity ^0.8.6;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import '@openzeppelin/contracts/access/Ownable.sol';

contract ShipTicketNFT is Ownable, ERC721, ERC721Enumerable {
    uint256 public maxSupply;
    uint256 public currentTokenId;

    constructor(
        string memory _name,
        string memory _symbol,
        uint256 _maxSupply
    ) ERC721(_name, _symbol) {
        maxSupply = _maxSupply;
    }

    function mint(address recipient) public onlyOwner {
        require(currentTokenId < maxSupply);

        _mint(recipient, currentTokenId);
        currentTokenId += 1;
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId
    ) internal override(ERC721, ERC721Enumerable) {
        super._beforeTokenTransfer(from, to, tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721Enumerable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
