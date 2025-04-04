// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {AgentToken} from "./AgentToken.sol";

contract AgentMerchant {
    struct AgentInfo {
        address walletAddress;
        address stockTokenAddress;
        uint256 pricePerToken;
        address creatorAddress;
    }

    // creator address => list of agent wallet addresses
    mapping(address => address[])
        public creatorAddressToAgentWalletAddressesMapper;
    // stock token address => agent wallet address
    mapping(address => address) public stockTokenToWalletAddressMapper;

    // agent wallet address => agent info
    mapping(address => AgentInfo) public agentInfoMapper;

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

    function createAgent(
        address walletAddress, //agent wallet address
        address stockTokenAddress //stock token address
    ) external returns (bool) {
        // check if agent wallet address already exists
        if (agentInfoMapper[walletAddress].walletAddress != address(0)) {
            revert("Agent wallet address already exists");
        }

        // check if stock token address already has an agent
        if (stockTokenToWalletAddressMapper[stockTokenAddress] != address(0)) {
            revert("Stock token address already has an agent");
        }

        // create agent token
        AgentToken agentToken = new AgentToken(walletAddress);

        //check if agent token mint authority is set to be the merchant contract
        require(
            agentToken.owner() == address(this),
            "Agent token mint authority is not set to be the merchant contract"
        );

        //register agent info
        agentInfoMapper[walletAddress] = AgentInfo({
            walletAddress: walletAddress,
            stockTokenAddress: stockTokenAddress,
            pricePerToken: 100, // 1.00 USDC per token
            creatorAddress: msg.sender
        });

        return true;
    }

    function purchaseStock(
        address stockTokenAddress,
        uint256 tokenAmount
    ) external returns (bool) {
        AgentInfo memory agentInfo = agentInfoMapper[
            stockTokenToWalletAddressMapper[stockTokenAddress]
        ];
        uint256 pricePerToken = agentInfo.pricePerToken;
        uint256 usdcAmount = (pricePerToken * tokenAmount) / PRICE_PRECISION;
        address agentWalletAddress = agentInfo.walletAddress;

        // transfer usdc : user -> agent wallet address
        // check if user has enough usdc
        if (usdcToken.balanceOf(msg.sender) < usdcAmount) {
            revert("User does not have enough usdc to purchase shares");
        }
        usdcToken.transferFrom(msg.sender, agentWalletAddress, usdcAmount);

        // mint agent tokens : agent wallet address -> user
        AgentToken(agentInfo.stockTokenAddress).mint(msg.sender, tokenAmount);

        return true;
    }


}
