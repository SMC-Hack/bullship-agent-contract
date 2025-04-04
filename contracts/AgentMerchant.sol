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
        address walletAddress,
        string memory name,
        string memory symbol
    ) external returns (bool) {
        // check if agent wallet address already exists
        if (agentInfoMapper[walletAddress].walletAddress != address(0)) {
            revert("Agent wallet address already exists");
        }

        // create agent token
        AgentToken agentToken = new AgentToken(walletAddress, name, symbol);

        //register agent info
        agentInfoMapper[walletAddress] = AgentInfo({
            walletAddress: walletAddress,
            stockTokenAddress: address(agentToken),
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

    function commitSellStock(
        address stockTokenAddress,
        uint256 tokenAmount
    ) external returns (bool) {
        //skip security check for now

        // main logic

        // transfer token : user -> contract
        AgentToken stockToken = AgentToken(stockTokenAddress);
        stockToken.burn(tokenAmount);

        // update sell share requests
        // find user sell share request
        bool found = false;
        for (
            uint256 i = 0;
            i < sellShareRequests[stockTokenAddress].length;
            i++
        ) {
            if (
                sellShareRequests[stockTokenAddress][i].userWalletAddress ==
                msg.sender
            ) {
                sellShareRequests[stockTokenAddress][i]
                    .tokenAmount += tokenAmount;
                found = true;
                break;
            }
        }
        if (!found) {
            sellShareRequests[stockTokenAddress].push(
                SellShareRequest({
                    userWalletAddress: msg.sender,
                    tokenAmount: tokenAmount
                })
            );
        }

        return true;
    }

    function _getTotalSellRequestTokenAmount(
        address stockTokenAddress
    ) internal view returns (uint256) {
        SellShareRequest[] memory tokenSellShareRequests = sellShareRequests[
            stockTokenAddress
        ];
        uint256 totalSellRequestTokenAmount = 0;
        for (uint256 i = 0; i < tokenSellShareRequests.length; i++) {
            totalSellRequestTokenAmount += tokenSellShareRequests[i]
                .tokenAmount;
        }
        return totalSellRequestTokenAmount;
    }

    function _computePricePerToken(
        address stockTokenAddress
    ) internal view returns (uint256) {
        uint256 totalSellRequestTokenAmount = _getTotalSellRequestTokenAmount( // this has been burned before in commitSellStock
            stockTokenAddress
        );
        uint256 currentTotalStockTokenSupply = AgentToken(stockTokenAddress)
            .totalSupply();
        uint256 trueTotalSupply = currentTotalStockTokenSupply +
            totalSellRequestTokenAmount;

        AgentInfo memory agentInfo = agentInfoMapper[
            stockTokenToWalletAddressMapper[stockTokenAddress]
        ];

        if (trueTotalSupply == 0) {
            return agentInfo.pricePerToken;
        }

        address agentWalletAddress = agentInfo.walletAddress;
        uint256 agentUsdcBalance = usdcToken.balanceOf(agentWalletAddress);

        return (agentUsdcBalance * PRICE_PRECISION) /
            trueTotalSupply;
    }
}
