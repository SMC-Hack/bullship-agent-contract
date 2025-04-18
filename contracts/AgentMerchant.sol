// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {AgentToken} from "./AgentToken.sol";

contract AgentMerchant {
    // Events
    event AgentCreated(address indexed walletAddress, address indexed creatorAddress, address stockTokenAddress, string name, string symbol, uint256 initialPrice);
    event StockPurchased(address indexed buyer, address indexed agentWalletAddress, address stockTokenAddress, uint256 tokenAmount, uint256 usdcAmount);
    event SellStockRequested(address indexed seller, address stockTokenAddress, uint256 tokenAmount);
    event SellRequestFulfilled(address indexed agentWalletAddress, address stockTokenAddress, uint256 totalTokenAmount, uint256 newPricePerToken, uint256 totalUsdcPaid);
    event PricePerTokenUpdated(address indexed agentWalletAddress, uint256 oldPricePerToken, uint256 newPricePerToken);
    event UsdcTokenAddressUpdated(address indexed oldAddress, address indexed newAddress);

    struct AgentInfo {
        address walletAddress;
        address stockTokenAddress;
        uint256 pricePerToken; //in usdc decimals units (1000000 = 1 usdc)
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
    address public owner;

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }

    address public cctpWrapperAddress;

    constructor(
        address _usdcTokenAddress,
        address _cctpWrapperAddress
    ) {
        usdcToken = IERC20(_usdcTokenAddress);
        owner = msg.sender;
        cctpWrapperAddress = _cctpWrapperAddress;
    }

    /**
     * @notice Allows the owner to update the USDC token address
     * @param _usdcTokenAddress New USDC token address
     */
    function updateUsdcTokenAddress(address _usdcTokenAddress) external onlyOwner {
        require(_usdcTokenAddress != address(0), "Invalid token address");
        address oldAddress = address(usdcToken);
        usdcToken = IERC20(_usdcTokenAddress);
        emit UsdcTokenAddressUpdated(oldAddress, _usdcTokenAddress);
    }

    function updateCctpWrapperAddress(address _cctpWrapperAddress) external onlyOwner {
        require(_cctpWrapperAddress != address(0), "Invalid cctp wrapper address");
        cctpWrapperAddress = _cctpWrapperAddress;
    }

    function createAgent(
        address walletAddress,
        string calldata name,
        string calldata symbol
    ) external returns (bool) {
        // check if agent wallet address already exists
        if (agentInfoMapper[walletAddress].walletAddress != address(0)) {
            revert("Agent wallet address already exists");
        }

        // create agent token
        AgentToken agentToken = new AgentToken(address(this), name, symbol);

        // Initial price of 1 USDC
        uint256 initialPrice = 1 * 1e6;

        //register agent info
        agentInfoMapper[walletAddress] = AgentInfo({
            walletAddress: walletAddress,
            stockTokenAddress: address(agentToken),
            pricePerToken: initialPrice,
            creatorAddress: msg.sender
        });

        stockTokenToWalletAddressMapper[address(agentToken)] = walletAddress;
        
        creatorAddressToAgentWalletAddressesMapper[msg.sender].push(walletAddress);

        // Emit event
        emit AgentCreated(walletAddress, msg.sender, address(agentToken), name, symbol, initialPrice);

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
        uint256 usdcAmount = (pricePerToken * tokenAmount);
        address agentWalletAddress = agentInfo.walletAddress;

        // transfer usdc : user -> agent wallet address
        // check if user has enough usdc
        if (usdcToken.balanceOf(msg.sender) < usdcAmount) {
            revert("User does not have enough usdc to purchase shares");
        }
        usdcToken.transferFrom(msg.sender, agentWalletAddress, usdcAmount);

        // mint agent tokens : agent wallet address -> user
        AgentToken(agentInfo.stockTokenAddress).mint(msg.sender, tokenAmount);

        // Emit event
        emit StockPurchased(msg.sender, agentWalletAddress, stockTokenAddress, tokenAmount, usdcAmount);

        return true;
    }

    function purchaseStockByUsdc(
        address stockTokenAddress,
        uint256 usdcAmount
    ) external returns (bool) {

        // transfer usdc : user -> agent wallet address
        // check if user has enough usdc
        if (usdcToken.balanceOf(msg.sender) < usdcAmount) {
            revert("User does not have enough usdc to purchase shares");
        }

        AgentInfo memory agentInfo = agentInfoMapper[
            stockTokenToWalletAddressMapper[stockTokenAddress]
        ];

        uint256 pricePerToken = agentInfo.pricePerToken;
        uint256 tokenAmount = usdcAmount / pricePerToken;
        
        usdcToken.transferFrom(msg.sender, agentInfo.walletAddress, usdcAmount);

        // mint agent tokens : agent wallet address -> user
        AgentToken(agentInfo.stockTokenAddress).mint(msg.sender, tokenAmount);

        // Emit event
        emit StockPurchased(msg.sender, agentInfo.walletAddress, stockTokenAddress, tokenAmount, usdcAmount);

        return true;
    }
    
    function crossChainPurchaseStock(
        address stockTokenAddress,
        uint256 usdcAmount,
        address userWalletAddress
    ) external returns (bool) {
        //skip security check for now
        // main logic

        require(
            msg.sender == cctpWrapperAddress, 
            "Only cctp wrapper can call this function"
        );

        // mint agent token to user
        AgentToken stockToken = AgentToken(stockTokenAddress);
        stockToken.mint(userWalletAddress, usdcAmount);

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

        // Emit event
        emit SellStockRequested(msg.sender, stockTokenAddress, tokenAmount);

        return true;
    }

    function fullfillSellStock() external returns (bool) {
        //must have security check
        address agentWalletAddress = msg.sender;
        AgentInfo memory agentInfo = agentInfoMapper[agentWalletAddress];
        address stockTokenAddress = agentInfo.stockTokenAddress;
        uint256 oldPricePerToken = agentInfo.pricePerToken;

        //compute pay back info
        (uint256 newPricePerToken, uint256 totalSellRequestTokenAmount) = computePayBackInfo(stockTokenAddress);

        //compute total money to pay back
        uint256 totalMoneyToPayBack = (newPricePerToken * totalSellRequestTokenAmount);

         //total balance in bot
        uint256 totalUsdcBalance = usdcToken.balanceOf(agentWalletAddress);

        //check if agent wallet address has enough usdc to pay back
        if (totalUsdcBalance < totalMoneyToPayBack) {
            revert("Agent wallet address does not have enough usdc to pay back");
        }

        //iterate through sell share requests and transfer usdc
        for (uint256 i = 0; i < sellShareRequests[stockTokenAddress].length; i++) {
            SellShareRequest memory sellShareRequest = sellShareRequests[stockTokenAddress][i];
            uint256 tokenAmount = sellShareRequest.tokenAmount;
            uint256 usdcAmount = (newPricePerToken * tokenAmount);
            usdcToken.transferFrom(agentWalletAddress, sellShareRequest.userWalletAddress, usdcAmount);
        }

        delete sellShareRequests[stockTokenAddress];

        agentInfoMapper[agentWalletAddress].pricePerToken = newPricePerToken;

        // Emit events
        emit SellRequestFulfilled(agentWalletAddress, stockTokenAddress, totalSellRequestTokenAmount, newPricePerToken, totalMoneyToPayBack);
        emit PricePerTokenUpdated(agentWalletAddress, oldPricePerToken, newPricePerToken);

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

    function computePayBackInfo(
        address stockTokenAddress
    ) internal view returns (uint256, uint256) {
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
            return (agentInfo.pricePerToken, totalSellRequestTokenAmount);
        }

        address agentWalletAddress = agentInfo.walletAddress;
        uint256 agentUsdcBalance = usdcToken.balanceOf(agentWalletAddress);

        return (
            agentUsdcBalance  / trueTotalSupply,
            totalSellRequestTokenAmount
        );
    }

    function getSellShareRequestsLength(
        address stockTokenAddress
    ) external view returns (uint256) {
        return sellShareRequests[stockTokenAddress].length;
    }

    function getAgentInfo(
        address walletAddress
    ) external view returns (address, address, uint256, address) {
        AgentInfo memory agentInfo = agentInfoMapper[walletAddress];
        return (agentInfo.walletAddress, agentInfo.stockTokenAddress, agentInfo.pricePerToken, agentInfo.creatorAddress);
    }
}
