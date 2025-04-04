// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockERC20
 * @dev Mock ERC20 token for testing
 */
contract MockERC20 is ERC20 {
    uint8 private _decimals;

    constructor(
        string memory name,
        string memory symbol,
        uint8 decimals_
    ) ERC20(name, symbol) {
        _decimals = decimals_;
    }

    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }

    /**
     * @dev Function to mint tokens
     * @param to The address that will receive the minted tokens
     * @param amount The amount of tokens to mint
     */
    function mint(address to, uint256 amount) public {
        _mint(to, amount);
    }

    /**
     * @dev Function to burn tokens
     * @param from The address whose tokens will be burned
     * @param amount The amount of tokens to burn
     */
    function burn(address from, uint256 amount) public {
        _burn(from, amount);
    }
} 