import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import axios from "axios";
import dotenv from "dotenv";
import { BigNumber } from "ethers";

// Load environment variables
dotenv.config();

// Constants - hardcoded for simplicity
// Replace these with actual values for your needs
const USDC_DECIMALS = 6;

// Chain configuration
const CHAIN_IDS_TO_USDC_ADDRESSES: { [key: number]: string } = {
  // Base Sepolia USDC
  84532: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  // Sepolia USDC
  11155111: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
};

// Token Messenger addresses
const TOKEN_MESSENGER_ADDRESS = "0x9f3d0ef0428df17cf8e9bd876b4f3267b9aba3ba";

// Message Transmitter address
const MESSAGE_TRANSMITTER_ADDRESS = "0xe737e5cebeeba77efe34d4aa090756590b1ce275";

// Destination domain mappings
const DESTINATION_DOMAINS: { [key: number]: number } = {
  84532: 6, // Base Sepolia
  11155111: 0, // Sepolia
};

// Hard-coded parameters
const SOURCE_CHAIN_ID = 84532; // Base Sepolia
const DESTINATION_CHAIN_ID = 11155111; // Sepolia
const TRANSFER_AMOUNT = "10"; // 10 USDC

// Helper functions for logging
const addLog = (message: string) => {
  console.log(`[${new Date().toLocaleTimeString()}] ${message}`);
};

async function approveUSDC(
  signer: SignerWithAddress,
  sourceChainId: number,
  amount: BigNumber
) {
  addLog("Approving USDC transfer...");

  try {
    // Create contract instance for USDC token
    const usdcTokenAddress = CHAIN_IDS_TO_USDC_ADDRESSES[sourceChainId];
    const usdcTokenAbi = [
      "function approve(address spender, uint256 amount) returns (bool)",
      "function balanceOf(address owner) view returns (uint256)",
      "function decimals() view returns (uint8)",
    ];
    
    const usdcToken = new ethers.Contract(usdcTokenAddress, usdcTokenAbi, signer);
    
    // Check USDC balance before approval
    const balance = await usdcToken.balanceOf(signer.address);
    addLog(`Current USDC balance: ${ethers.utils.formatUnits(balance, USDC_DECIMALS)} USDC`);
    
    if (balance.lt(amount)) {
      throw new Error(`Insufficient USDC balance. Have ${ethers.utils.formatUnits(balance, USDC_DECIMALS)}, need ${ethers.utils.formatUnits(amount, USDC_DECIMALS)}`);
    }
    
    // Approve TOKEN_MESSENGER_ADDRESS to spend USDC
    const tx = await usdcToken.approve(TOKEN_MESSENGER_ADDRESS, amount);
    addLog(`USDC Approval Tx: ${tx.hash}`);
    
    // Wait for transaction confirmation
    const receipt = await tx.wait();
    addLog(`Approval confirmed in block ${receipt.blockNumber}`);
    
    return tx.hash;
  } catch (error) {
    console.error("Error in approveUSDC:", error);
    throw error;
  }
}

async function burnUSDC(
  signer: SignerWithAddress,
  sourceChainId: number,
  amount: BigNumber,
  destinationChainId: number,
  transferType: "fast" | "standard" = "standard"
) {
  addLog("Burning USDC...");

  try {
    const finalityThreshold = transferType === "fast" ? 1000 : 2000;
    const maxFee = amount.sub(1); // Set max fee to amount - 1
    const mintRecipient = `0x${signer.address.slice(2).padStart(64, "0")}`;
    
    // Token Messenger contract interface
    const tokenMessengerAbi = [
      "function depositForBurn(uint256 amount, uint32 destinationDomain, bytes32 mintRecipient, address burnToken, bytes32 hookData, uint256 maxFee, uint32 finalityThreshold) returns ()"
    ];
    
    const tokenMessenger = new ethers.Contract(TOKEN_MESSENGER_ADDRESS, tokenMessengerAbi, signer);
    
    // Burn USDC
    const tx = await tokenMessenger.depositForBurn(
      amount,
      DESTINATION_DOMAINS[destinationChainId],
      mintRecipient,
      CHAIN_IDS_TO_USDC_ADDRESSES[sourceChainId],
      "0x0000000000000000000000000000000000000000000000000000000000000000", // Empty hook data
      maxFee,
      finalityThreshold
    );
    
    addLog(`Burn Tx: ${tx.hash}`);
    
    // Wait for transaction confirmation
    const receipt = await tx.wait();
    addLog(`Burn confirmed in block ${receipt.blockNumber}`);
    
    return tx.hash;
  } catch (error) {
    console.error("Error in burnUSDC:", error);
    throw error;
  }
}

async function retrieveAttestation(
  transactionHash: string,
  sourceChainId: number
) {
  addLog("Retrieving attestation...");

  const url = `https://iris-api-sandbox.circle.com/v2/messages/${DESTINATION_DOMAINS[sourceChainId]}?transactionHash=${transactionHash}`;

  let attempts = 0;
  const MAX_ATTEMPTS = 120; // ~10 minutes with 5s intervals
  
  while (attempts < MAX_ATTEMPTS) {
    try {
      const response = await axios.get(url);
      if (response.data?.messages?.[0]?.status === "complete") {
        addLog("Attestation retrieved successfully!");
        return response.data.messages[0];
      }
      
      attempts++;
      const waitTime = 5000; // 5 seconds
      addLog(`Waiting for attestation... (${attempts}/${MAX_ATTEMPTS})`);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        attempts++;
        await new Promise((resolve) => setTimeout(resolve, 5000));
        continue;
      }
      console.error("Error retrieving attestation:", error);
      throw error;
    }
  }
  
  throw new Error("Attestation retrieval timed out");
}

async function mintUSDC(
  signer: SignerWithAddress,
  destinationChainId: number,
  attestation: any
) {
  addLog("Minting USDC...");

  try {
    // Message Transmitter contract interface
    const messageTransmitterAbi = [
      "function receiveMessage(bytes message, bytes attestation) returns ()"
    ];
    
    const messageTransmitter = new ethers.Contract(MESSAGE_TRANSMITTER_ADDRESS, messageTransmitterAbi, signer);
    
    // Submit the mint transaction
    addLog("Submitting mint transaction...");
    
    const tx = await messageTransmitter.receiveMessage(
      attestation.message,
      attestation.attestation
    );
    
    addLog(`Mint Tx: ${tx.hash}`);
    
    // Wait for transaction confirmation
    const receipt = await tx.wait();
    addLog(`Mint confirmed in block ${receipt.blockNumber}`);
    
    addLog("Transfer completed successfully!");
  } catch (error) {
    console.error("Error in mintUSDC:", error);
    throw error;
  }
}

async function main() {
  try {
    addLog("Starting cross-chain USDC transfer script");
    
    // Get signer
    const [signer] = await ethers.getSigners();
    addLog(`Using signer address: ${signer.address}`);
    
    // Convert string amount to BigNumber with proper decimals
    const transferAmount = ethers.utils.parseUnits(TRANSFER_AMOUNT, USDC_DECIMALS);
    
    addLog(`Preparing to transfer ${TRANSFER_AMOUNT} USDC from chain ${SOURCE_CHAIN_ID} to chain ${DESTINATION_CHAIN_ID}`);
    
    // Step 1: Approve TOKEN_MESSENGER_ADDRESS to spend USDC
    await approveUSDC(signer, SOURCE_CHAIN_ID, transferAmount);
    
    // Step 2: Burn USDC on source chain
    const burnTxHash = await burnUSDC(
      signer,
      SOURCE_CHAIN_ID,
      transferAmount,
      DESTINATION_CHAIN_ID,
      "standard"
    );
    
    // Step 3: Retrieve attestation
    const attestation = await retrieveAttestation(burnTxHash, SOURCE_CHAIN_ID);
    
    // Step 4: Mint USDC on destination chain
    await mintUSDC(signer, DESTINATION_CHAIN_ID, attestation);
    
    addLog("Cross-chain transfer completed successfully!");
  } catch (error) {
    console.error("Error in cross-chain transfer:", error);
    process.exit(1);
  }
}

// Execute the script
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
