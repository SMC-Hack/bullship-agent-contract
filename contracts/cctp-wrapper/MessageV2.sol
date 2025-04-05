/*
 * Copyright 2024 Circle Internet Group, Inc. All rights reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
pragma solidity ^0.8.22;

/**
 * @title MessageV2 Library
 * @notice Library for formatted v2 messages used by Relayer and Receiver.
 *
 * @dev The message body is dynamically-sized to support custom message body
 * formats. Other fields must be fixed-size to avoid hash collisions.
 * Each other input value has an explicit type to guarantee fixed-size.
 * Padding: uintNN fields are left-padded, and bytesNN fields are right-padded.
 *
 * Field                        Bytes      Type       Index
 * version                      4          uint32     0
 * sourceDomain                 4          uint32     4
 * destinationDomain            4          uint32     8
 * nonce                        32         bytes32    12
 * sender                       32         bytes32    44
 * recipient                    32         bytes32    76
 * destinationCaller            32         bytes32    108
 * minFinalityThreshold         4          uint32     140
 * finalityThresholdExecuted    4          uint32     144
 * messageBody                  dynamic    bytes      148
 * @dev Differences from v1:
 * - Nonce is now bytes32 (vs. uint64)
 * - minFinalityThreshold added
 * - finalityThresholdExecuted added
 **/
library MessageV2 {
    // Indices of each field in message
    uint8 private constant VERSION_INDEX = 0;
    uint8 private constant SOURCE_DOMAIN_INDEX = 4;
    uint8 private constant DESTINATION_DOMAIN_INDEX = 8;
    uint8 private constant NONCE_INDEX = 12;
    uint8 private constant SENDER_INDEX = 44;
    uint8 private constant RECIPIENT_INDEX = 76;
    uint8 private constant DESTINATION_CALLER_INDEX = 108;
    uint8 private constant MIN_FINALITY_THRESHOLD_INDEX = 140;
    uint8 private constant FINALITY_THRESHOLD_EXECUTED_INDEX = 144;
    uint8 private constant MESSAGE_BODY_INDEX = 148;
    uint8 private constant FIXED_FIELDS_LENGTH = 148; // Length without the messageBody field

    bytes32 private constant EMPTY_NONCE = bytes32(0);
    uint32 private constant EMPTY_FINALITY_THRESHOLD_EXECUTED = 0;

    /**
     * @notice Returns formatted (packed) message with provided fields
     * @param _version the version of the message format
     * @param _sourceDomain Domain of home chain
     * @param _destinationDomain Domain of destination chain
     * @param _sender Address of sender on source chain as bytes32
     * @param _recipient Address of recipient on destination chain as bytes32
     * @param _destinationCaller Address of caller on destination chain as bytes32
     * @param _minFinalityThreshold the minimum finality at which the message should be attested to
     * @param _messageBody Raw bytes of message body
     * @return Formatted message
     **/
    function _formatMessageForRelay(
        uint32 _version,
        uint32 _sourceDomain,
        uint32 _destinationDomain,
        bytes32 _sender,
        bytes32 _recipient,
        bytes32 _destinationCaller,
        uint32 _minFinalityThreshold,
        bytes calldata _messageBody
    ) internal pure returns (bytes memory) {
        return
            abi.encodePacked(
                _version,
                _sourceDomain,
                _destinationDomain,
                EMPTY_NONCE,
                _sender,
                _recipient,
                _destinationCaller,
                _minFinalityThreshold,
                EMPTY_FINALITY_THRESHOLD_EXECUTED,
                _messageBody
            );
    }

    // @notice Returns _message's version field
    function _getVersion(bytes memory _message) internal pure returns (uint32) {
        uint32 result;
        
        assembly {
            // Load 4 bytes and convert to uint32
            let word := mload(add(_message, add(VERSION_INDEX, 32)))
            result := shr(224, word) // Shift right by 224 bits (256 - 32)
        }
        
        return result;
    }

    // @notice Returns _message's sourceDomain field
    function _getSourceDomain(bytes memory _message) internal pure returns (uint32) {
        uint32 result;
        
        assembly {
            // Load 4 bytes and convert to uint32
            let word := mload(add(_message, add(SOURCE_DOMAIN_INDEX, 32)))
            result := shr(224, word) // Shift right by 224 bits (256 - 32)
        }
        
        return result;
    }

    // @notice Returns _message's destinationDomain field
    function _getDestinationDomain(
        bytes memory _message
    ) internal pure returns (uint32) {
        uint32 result;
        
        assembly {
            // Load 4 bytes and convert to uint32
            let word := mload(add(_message, add(DESTINATION_DOMAIN_INDEX, 32)))
            result := shr(224, word) // Shift right by 224 bits (256 - 32)
        }
        
        return result;
    }

    // @notice Returns _message's nonce field
    function _getNonce(bytes memory _message) internal pure returns (bytes32) {
        bytes32 result;
        
        assembly {
            // Load bytes32 from memory starting at NONCE_INDEX + 32
            result := mload(add(_message, add(NONCE_INDEX, 32)))
        }
        
        return result;
    }

    // @notice Returns _message's sender field
    function _getSender(bytes memory _message) internal pure returns (bytes32) {
        bytes32 result;
        
        assembly {
            // Load bytes32 from memory starting at SENDER_INDEX + 32
            result := mload(add(_message, add(SENDER_INDEX, 32)))
        }
        
        return result;
    }

    // @notice Returns _message's recipient field
    function _getRecipient(bytes memory _message) internal pure returns (bytes32) {
        bytes32 result;
        
        assembly {
            // Load bytes32 from memory starting at RECIPIENT_INDEX + 32
            result := mload(add(_message, add(RECIPIENT_INDEX, 32)))
        }
        
        return result;
    }

    // @notice Returns _message's destinationCaller field
    function _getDestinationCaller(
        bytes memory _message
    ) internal pure returns (bytes32) {
        bytes32 result;
        
        assembly {
            // Load bytes32 from memory starting at DESTINATION_CALLER_INDEX + 32
            result := mload(add(_message, add(DESTINATION_CALLER_INDEX, 32)))
        }
        
        return result;
    }

    // @notice Returns _message's minFinalityThreshold field
    function _getMinFinalityThreshold(
        bytes memory _message
    ) internal pure returns (uint32) {
        uint32 result;
        
        assembly {
            // Load 4 bytes and convert to uint32
            let word := mload(add(_message, add(MIN_FINALITY_THRESHOLD_INDEX, 32)))
            result := shr(224, word) // Shift right by 224 bits (256 - 32)
        }
        
        return result;
    }

    // @notice Returns _message's finalityThresholdExecuted field
    function _getFinalityThresholdExecuted(
        bytes memory _message
    ) internal pure returns (uint32) {
        uint32 result;
        
        assembly {
            // Load 4 bytes and convert to uint32
            let word := mload(add(_message, add(FINALITY_THRESHOLD_EXECUTED_INDEX, 32)))
            result := shr(224, word) // Shift right by 224 bits (256 - 32)
        }
        
        return result;
    }

    // @notice Returns _message's messageBody field
    function _getMessageBody(bytes memory _message) internal pure returns (bytes memory) {
        // Calculate the length of the message body (total length - fixed fields length)
        uint256 bodyLength = _message.length - MESSAGE_BODY_INDEX;
        bytes memory result = new bytes(bodyLength);
        
        if (bodyLength > 0) {
            assembly {
                // Copy bytes from _message to result
                // Start position in _message: MESSAGE_BODY_INDEX + 32 (for bytes length prefix)
                // Target position in result: 32 (for bytes length prefix)
                // Length to copy: bodyLength
                let sourcePos := add(add(_message, 32), MESSAGE_BODY_INDEX)
                let targetPos := add(result, 32)
                for { let i := 0 } lt(i, bodyLength) { i := add(i, 32) } {
                    // Copy 32 bytes at a time, but be careful not to overflow
                    let remaining := sub(bodyLength, i)
                    // If less than 32 bytes remain, only copy that many
                    let toCopy := 32
                    if lt(remaining, 32) {
                        toCopy := remaining
                    }
                    
                    // Copy the bytes
                    mstore(add(targetPos, i), mload(add(sourcePos, i)))
                }
            }
        }
        
        return result;
    }

    /**
     * @notice Validates if message is properly formatted
     * @param _message The message as bytes
     */
    function _validateMessageFormat(bytes memory _message) internal pure {
        require(_message.length >= FIXED_FIELDS_LENGTH, "Invalid message: too short");
    }
}
