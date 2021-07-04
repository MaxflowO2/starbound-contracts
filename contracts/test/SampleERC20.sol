pragma solidity ^0.7.6;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';

contract SampleERC20 is ERC20('SampleERC20', 'SE') {
    constructor(uint8 _decimals, uint256 _totalSupply) public {
        _setupDecimals(_decimals);
        _mint(msg.sender, _totalSupply);
    }
}
