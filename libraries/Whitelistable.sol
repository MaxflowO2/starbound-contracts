//SPDX-License-Identifier: Unlicense
pragma solidity ^0.7.6;

import "@openzeppelin/contracts/access/Ownable.sol";

contract Whitelistable is Ownable {
    mapping(address => bool) public preSaleWhitelist;

    /**
     * @dev Restrict access based on whitelist.
     *
     */
    modifier onlyWhitelist() {
        require(isWhitelisted(_msgSender()), "Whitelistable: You're not on the whitelist.");
        _;
    }

    /**
     * @dev Add an address to the whitelist.
     *
     */
    function addToWhitelist(address[] memory asses) external onlyOwner {
        for (uint256 i = 0; i < asses.length; i++) {
            preSaleWhitelist[asses[i]] = true;
        }
    }

    /**
     * @dev Remove an address from the whitelist.
     *
     */
    function removeFromWhitelist(address[] memory asses) external onlyOwner {
        for (uint256 i = 0; i < asses.length; i++) {
            preSaleWhitelist[asses[i]] = false;
        }
    }

    /**
     * @dev public function for whitelist checks
     * coming from the frontend.
     */
    function isOnWhitelist() public view returns (bool) {
        return isWhitelisted(_msgSender());
    }

    /**
     * @dev Internal function for whitelist checks.
     *
     */
    function isWhitelisted(address _address) internal view returns (bool) {
        return preSaleWhitelist[_address];
    }
}