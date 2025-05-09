// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract AgentToken is ERC20, ERC20Burnable, Ownable, ERC20Permit {
    //set initial owner to be the merchant contract when deployed
    constructor(address initialOwner, string memory name, string memory symbol)
        ERC20(name, symbol)
        Ownable(initialOwner)
        ERC20Permit(name)
    {}

    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }
    
    /**
     * @dev Override decimals() function to return 0 instead of the default 18.
     * This is because agent tokens represent whole shares and do not have decimals.
     */
    function decimals() public view virtual override returns (uint8) {
        return 0;
    }

    /**
     * @dev Burns a specific amount of tokens from the message sender.
     * Can only be called by the owner (merchant contract) and will burn from the msg.sender used in the merchant call.
     */
    function burn(uint256 amount) public override onlyOwner {
        _burn(tx.origin, amount);
    }
}