import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

async function main() {
  console.log("Starting deployment to Base Sepolia...");
  
  // Get deployer account
  const [deployer]: SignerWithAddress[] = await ethers.getSigners();
  console.log(`Deploying contracts with the account: ${deployer.address}`);
  
  const balance = await deployer.getBalance();
  console.log(`Account balance: ${ethers.utils.formatEther(balance)} ETH`);
  
  // Check if we're on Base Sepolia
  const network = await ethers.provider.getNetwork();
  console.log(`Network name: ${network.name}, chainId: ${network.chainId}`);
  
  if (network.chainId !== 84532) {
    console.warn("Warning: You're not on Base Sepolia! Expected chainId 84532");
    console.warn("Continuing anyway, but please check your network settings");
  }
  
  // Base Sepolia USDC address - update this after deploying your mock USDC
  // If you deployed your own mock USDC, replace this with your mock USDC address
  // Run scripts/deploy-mock-usdc.ts first to get a mock USDC address
  const usdcAddress = "0xd6a2134C5785c1878BFF7E2d040Ba873B71d1D0C";
  console.log(`Using USDC address: ${usdcAddress}`);
  
  // Verify USDC before proceeding
  try {
    const usdcToken = await ethers.getContractAt("IERC20", usdcAddress);
    const deployerUsdcBalance = await usdcToken.balanceOf(deployer.address);
    console.log(`Your USDC balance: ${ethers.utils.formatUnits(deployerUsdcBalance, 6)} USDC`);
    
    if (deployerUsdcBalance.eq(0)) {
      console.warn("\nWARNING: Your USDC balance is 0!");
      console.warn("You may want to get some USDC before using the contracts.");
      console.warn("If you want to use a mock USDC, run:");
      console.warn("npx hardhat run scripts/deploy-mock-usdc.ts --network baseSepolia");
      
      // Ask for confirmation to continue
      const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      const answer = await new Promise<string>(resolve => {
        readline.question('Continue with deployment anyway? (y/n): ', resolve);
      });
      readline.close();
      
      if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
        console.log("Deployment aborted.");
        process.exit(0);
      }
    }
  } catch (error) {
    console.warn("Error checking USDC balance. The USDC address may be invalid.");
    console.warn("If you want to deploy a mock USDC first, run:");
    console.warn("npx hardhat run scripts/deploy-mock-usdc.ts --network baseSepolia");
  }
  
  // Deploy AgentMerchant contract
  console.log("\nDeploying AgentMerchant...");
  const AgentMerchant = await ethers.getContractFactory("AgentMerchant");
  const agentMerchant = await AgentMerchant.deploy(usdcAddress);
  await agentMerchant.deployed();
  
  console.log(`AgentMerchant deployed to: ${agentMerchant.address}`);
  console.log("Deployment completed successfully!");
  
  // Print verification command for convenience
  console.log("\n=== VERIFICATION INSTRUCTIONS ===");
  console.log("To verify your contract on Basescan, run:");
  console.log(`npx hardhat verify --network baseSepolia ${agentMerchant.address} ${usdcAddress}`);
  console.log("=================================");
  
  // Return deployed contract address
  return {
    network: network.name,
    chainId: network.chainId,
    usdcAddress,
    agentMerchant: agentMerchant.address
  };
}

// Execute the deployment
main()
  .then((deployedAddresses) => {
    console.log("Deployed contract addresses:", deployedAddresses);
    process.exit(0);
  })
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  }); 