// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts ^5.0.0
pragma solidity ^0.8.22;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

contract AgentToken is ERC20, ERC20Burnable, ERC20Permit {
    address public mintAuthority;
    
    constructor(
        string memory name,
        string memory symbol,
        address initialMintAuthority
    )
        ERC20(name, symbol)
        ERC20Permit(name)
    {
        mintAuthority = initialMintAuthority;
    }

    function mint(address to, uint256 amount) public {
        require(msg.sender == mintAuthority, "Not authorized to mint");
        _mint(to, amount);
    }
    
}
