// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;
import {TypedMemView} from "@summa-tx/memview-sol/contracts/TypedMemView.sol";
import {IReceiverV2} from "./IReceiverV2.sol";
import {MessageV2} from "./MessageV2.sol";
import {BurnMessageV2} from './BurnMessageV2.sol';
import {AgentMerchant} from "../AgentMerchant.sol";
import {AgentInfo} from "../AgentMerchant.sol";
import {MockERC20} from "../test/MockERC20.sol"; 
import {Ownable2Step} from "./Ownable2Step.sol";

contract CCTPHookWrapper  {
    using TypedMemView for bytes;

    // Address of the destination chain message transmitter
    IReceiverV2 public immutable messageTransmitter;

    uint256 internal constant ADDRESS_BYTE_LENGTH = 20;

    // ============ Libraries ============
    using TypedMemView for bytes;
    using TypedMemView for bytes29;

    constructor(
        address _messageTransmitter,
        address _agentMerchant,
        address _mockUsdc
    ) Ownable2Step() {
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
        returns (
            bool relaySuccess,
            bool hookSuccess,
            bytes memory hookReturnData
        )
        
    {
        // Validate message
        bytes29 _msg = message.ref(0);
        MessageV2._validateMessageFormat(_msg);
        require(
            MessageV2._getVersion(_msg) == supportedMessageVersion,
            "Invalid message version"
        );

        // Validate burn message
        bytes29 _msgBody = MessageV2._getMessageBody(_msg);
        BurnMessageV2._validateBurnMessageFormat(_msgBody);
        require(
            BurnMessageV2._getVersion(_msgBody) == supportedMessageBodyVersion,
            "Invalid message body version"
        );


        // Relay message
        relaySuccess = messageTransmitter.receiveMessage(message, attestation);
        require(relaySuccess, "Receive message failed");

        // data from message for security check
        // we'll only check sender, recipient, amount
        bytes32 sender = BurnMessageV2._getMessageSender(_msgBody);
        bytes32 mintRecipient = BurnMessageV2._getMintRecipient(_msgBody);
        uint256 amount = BurnMessageV2._getAmount(_msgBody);

        address senderAddress = address(uint160(uint256(sender)));
        address mintRecipientAddress = address(uint160(uint256(mintRecipient)));
        
        //mint mock usdct to recipient (for POC purpose)
        // since we have our own mock usdc, while circle
        // has their own mock usdc, we need to mint mock usdc to recipient
        // to make it seamless with testnet demo
        // ** NEEDED TO BE REMOVED ON MAINNET **

        mockUsdc.mint(mintRecipientAddress, amount);


        AgentInfo memory agentInfo = agentMerchant.agentInfoMapper[mintRecipientAddress];
        require(agentInfo.walletAddress != address(0), "Agent not found");

        purchaseSuccess = agentMerchant.purchaseStock(
            agentInfo.stockTokenAddress,
            amount,
            senderAddress
        );
        require(purchaseSuccess, "Purchase stock failed");

        return true;
    }
}