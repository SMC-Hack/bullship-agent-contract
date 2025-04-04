// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract AgentMerchant {

    struct AgentInfo {
      address walletAddress;
      address stockTokenAddress;
      uint256 pricePerToken;
      address creatorAddress;
    }

    mapping(address => AgentInfo) public agentInfo;
    
    // creator address => agent wallet addresses
    mapping(address => address[]) public creatorAddressToAgentWalletAddresses;
    // stock token address => agent wallet address
    mapping(address => address) public stockTokenToWalletAddress;

    // agent wallet address => agent info
    mapping(address => AgentInfo) public agentInfos;


    struct SellShareRequest {
    address userWalletAddress;
    uint256 tokenAmount;
  }

    // agent wallet address => list of sell share requests
    mapping(address => SellShareRequest[]) public sellShareRequests;

    IERC20 public usdcToken;
  
    // Price scaling factor to handle decimal values (2 decimal places, min price = 0.01)
    uint256 public constant PRICE_PRECISION = 100;

    constructor(address _usdcTokenAddress) {
        usdcToken = IERC20(_usdcTokenAddress);
    }
    
}
