/*
 * Copyright (c) 2022, Circle Internet Financial Limited.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
pragma solidity ^0.8.22;

/**
 * @title BurnMessage Library
 * @notice Library for formatted BurnMessages used by TokenMessenger.
 * @dev BurnMessage format:
 * Field                 Bytes      Type       Index
 * version               4          uint32     0
 * burnToken             32         bytes32    4
 * mintRecipient         32         bytes32    36
 * amount                32         uint256    68
 * messageSender         32         bytes32    100
 **/
library BurnMessage {
    // Field indices and lengths
    uint8 private constant VERSION_INDEX = 0;
    uint8 private constant VERSION_LEN = 4;
    uint8 private constant BURN_TOKEN_INDEX = 4;
    uint8 private constant BURN_TOKEN_LEN = 32;
    uint8 private constant MINT_RECIPIENT_INDEX = 36;
    uint8 private constant MINT_RECIPIENT_LEN = 32;
    uint8 private constant AMOUNT_INDEX = 68;
    uint8 private constant AMOUNT_LEN = 32;
    uint8 private constant MSG_SENDER_INDEX = 100;
    uint8 private constant MSG_SENDER_LEN = 32;
    // 4 byte version + 32 bytes burnToken + 32 bytes mintRecipient + 32 bytes amount + 32 bytes messageSender
    uint8 private constant BURN_MESSAGE_LEN = 132;

    /**
     * @notice Formats Burn message
     * @param _version The message body version
     * @param _burnToken The burn token address on source domain as bytes32
     * @param _mintRecipient The mint recipient address as bytes32
     * @param _amount The burn amount
     * @param _messageSender The message sender
     * @return Burn formatted message.
     */
    function _formatMessage(
        uint32 _version,
        bytes32 _burnToken,
        bytes32 _mintRecipient,
        uint256 _amount,
        bytes32 _messageSender
    ) internal pure returns (bytes memory) {
        return
            abi.encodePacked(
                _version,
                _burnToken,
                _mintRecipient,
                _amount,
                _messageSender
            );
    }

    /**
     * @notice Retrieves the messageSender from a DepositForBurn BurnMessage
     * @param _message The message
     * @return messageSender as bytes32
     */
    function _getMessageSender(bytes memory _message)
        internal
        pure
        returns (bytes32)
    {
        bytes32 result;
        
        assembly {
            // Load bytes32 from memory starting at MSG_SENDER_INDEX + 32 (to account for the length prefix of bytes)
            result := mload(add(_message, add(MSG_SENDER_INDEX, 32)))
        }
        
        return result;
    }

    /**
     * @notice Retrieves the burnToken from a DepositForBurn BurnMessage
     * @param _message The message
     * @return sourceToken address as bytes32
     */
    function _getBurnToken(bytes memory _message) internal pure returns (bytes32) {
        bytes32 result;
        
        assembly {
            // Load bytes32 from memory starting at BURN_TOKEN_INDEX + 32
            result := mload(add(_message, add(BURN_TOKEN_INDEX, 32)))
        }
        
        return result;
    }

    /**
     * @notice Retrieves the mintRecipient from a BurnMessage
     * @param _message The message
     * @return mintRecipient
     */
    function _getMintRecipient(bytes memory _message)
        internal
        pure
        returns (bytes32)
    {
        bytes32 result;
        
        assembly {
            // Load bytes32 from memory starting at MINT_RECIPIENT_INDEX + 32
            result := mload(add(_message, add(MINT_RECIPIENT_INDEX, 32)))
        }
        
        return result;
    }

    /**
     * @notice Retrieves the amount from a BurnMessage
     * @param _message The message
     * @return amount
     */
    function _getAmount(bytes memory _message) internal pure returns (uint256) {
        uint256 result;
        
        assembly {
            // Load uint256 from memory starting at AMOUNT_INDEX + 32
            result := mload(add(_message, add(AMOUNT_INDEX, 32)))
        }
        
        return result;
    }

    /**
     * @notice Retrieves the version from a Burn message
     * @param _message The message
     * @return version
     */
    function _getVersion(bytes memory _message) internal pure returns (uint32) {
        uint32 result;
        
        assembly {
            // Load 4 bytes and convert to uint32
            // We need to get the bytes at the right position and shift right to ignore extraneous bytes
            let word := mload(add(_message, add(VERSION_INDEX, 32)))
            result := shr(224, word) // Shift right by 224 bits (256 - 32)
        }
        
        return result;
    }

    /**
     * @notice Validates if burn message is properly formatted
     * @param _message The burn message as bytes
     */
    function _validateBurnMessageFormat(bytes memory _message) internal pure {
        require(_message.length == BURN_MESSAGE_LEN, "Invalid message length");
    }
}
