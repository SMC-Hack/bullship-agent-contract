import { ethers } from "hardhat";
import { AgentMerchant } from "../typechain-types";

/**
 * Interaction script for Base Sepolia
 * 
 * Update these variables with your deployed contract addresses
 */
const AGENT_MERCHANT_ADDRESS = "REPLACE_WITH_DEPLOYED_ADDRESS";
const USDC_ADDRESS = "0x036CbD53842c5426634e7929541eC2318f3dCF7e"; // Base Sepolia USDC address

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Interacting with contracts on Base Sepolia from: ${deployer.address}`);
  
  // Check if we're on Base Sepolia
  const network = await ethers.provider.getNetwork();
  if (network.chainId !== 84532) {
    console.warn("Warning: You're not on Base Sepolia! Expected chainId 84532");
    console.warn("Continuing anyway, but please check your network settings");
  }
  
  // Connect to deployed contracts
  console.log(`Connecting to AgentMerchant at ${AGENT_MERCHANT_ADDRESS}...`);
  const agentMerchant = await ethers.getContractAt("AgentMerchant", AGENT_MERCHANT_ADDRESS) as AgentMerchant;
  console.log(`Connecting to USDC at ${USDC_ADDRESS}...`);
  const usdcToken = await ethers.getContractAt("IERC20", USDC_ADDRESS);
  
  // Get USDC balance
  try {
    const usdcBalance = await usdcToken.balanceOf(deployer.address);
    console.log(`USDC Balance: ${ethers.utils.formatUnits(usdcBalance, 6)} USDC`);
    
    if (usdcBalance.eq(0)) {
      console.warn("Warning: Your USDC balance is 0! You'll need USDC to interact with the contract.");
      console.warn("You can get Base Sepolia USDC from a faucet or bridge from Ethereum Sepolia.");
    }
  } catch (error) {
    console.error("Error checking USDC balance:", error);
    console.log("Make sure the USDC address is correct for Base Sepolia.");
  }
  
  // Menu of operations
  console.log("\n=== AGENT MERCHANT OPERATIONS ===");
  console.log("1. Create a new agent");
  console.log("2. Purchase agent tokens");
  console.log("3. Commit to sell agent tokens");
  console.log("4. Fulfill sell requests (agent owner only)");
  
  console.log("\nTo create a new agent, run the following in your code:");
  console.log(`await agentMerchant.createAgent(AGENT_WALLET_ADDRESS, "AGENT_NAME", "SYMBOL");`);
  
  console.log("\nTo purchase agent tokens:");
  console.log(`const tokenAddress = "AGENT_TOKEN_ADDRESS"; // Get this from agentInfoMapper`);
  console.log(`const amount = 10; // Number of tokens to buy (whole numbers only)`);
  console.log(`await usdcToken.approve(agentMerchant.address, AMOUNT_IN_USDC);`);
  console.log(`await agentMerchant.purchaseStock(tokenAddress, amount);`);
  
  console.log("\nInteraction script completed!");
}

// Execute interaction
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Interaction failed:", error);
    process.exit(1);
  }); 