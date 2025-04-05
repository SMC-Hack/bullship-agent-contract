// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;
import {IReceiverV2} from "./IReceiverV2.sol";
import {MessageV2} from "./MessageV2.sol";
import {BurnMessageV2} from "./BurnMessageV2.sol";
import {AgentMerchant} from "../AgentMerchant.sol";
import {MockERC20} from "../test/MockERC20.sol";

contract CCTPHookWrapper {
    // Address of the destination chain message transmitter
    IReceiverV2 public immutable messageTransmitter;

    uint256 internal constant ADDRESS_BYTE_LENGTH = 20;

    // Missing variables from original code that are referenced
    AgentMerchant public agentMerchant;
    MockERC20 public mockUsdc;
    uint32 public supportedMessageVersion;
    uint32 public supportedMessageBodyVersion;

    constructor(
        address _messageTransmitter,
        address _agentMerchant,
        address _mockUsdc
    ) {
        require(
            _messageTransmitter != address(0),
            "Message transmitter is the zero address"
        );

        messageTransmitter = IReceiverV2(_messageTransmitter);
        agentMerchant = AgentMerchant(_agentMerchant);
        mockUsdc = MockERC20(_mockUsdc);
    }

    //in original they implement owner check but ignore for now
    function receiveMessage(
        bytes calldata message,
        bytes calldata attestation
    )
        external
        virtual
        returns (bool)
    {
        // Validate message
        MessageV2._validateMessageFormat(message);
        require(
            MessageV2._getVersion(message) == supportedMessageVersion,
            "Invalid message version"
        );

        // Validate burn message
        bytes memory msgBody = MessageV2._getMessageBody(message);
        BurnMessageV2._validateBurnMessageFormat(msgBody);
        require(
            BurnMessageV2._getVersion(msgBody) == supportedMessageBodyVersion,
            "Invalid message body version"
        );

        // Relay message
        bool relaySuccess = messageTransmitter.receiveMessage(message, attestation);
        require(relaySuccess, "Receive message failed");

        // data from message for security check
        // we'll only check sender, recipient, amount
        bytes32 sender = BurnMessageV2._getMessageSender(msgBody);
        bytes32 mintRecipient = BurnMessageV2._getMintRecipient(msgBody);
        uint256 amount = BurnMessageV2._getAmount(msgBody);

        address senderAddress = address(uint160(uint256(sender)));
        address mintRecipientAddress = address(uint160(uint256(mintRecipient)));

        //mint mock usdct to recipient (for POC purpose)
        // since we have our own mock usdc, while circle
        // has their own mock usdc, we need to mint mock usdc to recipient
        // to make it seamless with testnet demo
        // ** NEEDED TO BE REMOVED ON MAINNET **

        mockUsdc.mint(mintRecipientAddress, amount);

        (address walletAddress, address stockTokenAddress, , ) = agentMerchant.getAgentInfo(mintRecipientAddress);
        
        require(walletAddress != address(0), "Agent not found");

        bool purchaseSuccess = agentMerchant.crossChainPurchaseStock(
            stockTokenAddress,
            amount,
            senderAddress
        );
        require(purchaseSuccess, "Purchase stock failed");

        return true;
    }
}
