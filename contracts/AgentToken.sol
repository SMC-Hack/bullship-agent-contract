// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract AgentToken is ERC20, ERC20Burnable, Ownable, ERC20Permit {
    //set initial owner to be the merchant contract when deployed
    constructor(address initialOwner)
        ERC20("Agent Token", "AGENT")
        Ownable(initialOwner)
        ERC20Permit("Agent Token")
    {}

    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }
}