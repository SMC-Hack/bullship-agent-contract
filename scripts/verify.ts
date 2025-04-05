import { run } from "hardhat";

/**
 * Verification script for Base Sepolia
 * 
 * Update these variables with your deployed contract addresses
 */
const AGENT_MERCHANT_ADDRESS = "0xdB075f41F4ee7b67E8a2E041dD0AC78Db04BbBE4";
const USDC_ADDRESS = "0x036CbD53842c5426634e7929541eC2318f3dCF7e"; // Base Sepolia USDC address

async function main() {
  console.log("Starting contract verification on Base Sepolia...");
  
  try {
    // Verify AgentMerchant
    console.log(`Verifying AgentMerchant at ${AGENT_MERCHANT_ADDRESS}...`);
    await run("verify:verify", {
      address: AGENT_MERCHANT_ADDRESS,
      constructorArguments: [USDC_ADDRESS],
      contract: "contracts/AgentMerchant.sol:AgentMerchant"
    });
    console.log("AgentMerchant verification complete!");
    
    // Note about verifying agent tokens
    console.log("\nIMPORTANT: For AgentToken contracts created by the merchant:");
    console.log("1. Get the token address from agentInfoMapper or contract events");
    console.log("2. Run the following command for each token:");
    console.log(`   npx hardhat verify --network baseSepolia TOKEN_ADDRESS MERCHANT_ADDRESS "TOKEN_NAME" "TOKEN_SYMBOL"`);
    console.log("   Where:");
    console.log("   - TOKEN_ADDRESS is the address of the deployed token");
    console.log("   - MERCHANT_ADDRESS is the address of the AgentMerchant contract");
    console.log("   - TOKEN_NAME and TOKEN_SYMBOL are the name and symbol you used when creating the agent");
    
  } catch (error) {
    console.error("Verification failed:", error);
  }
}

// Execute verification
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 