import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { MockERC20, MockERC20__factory } from "../typechain-types";

async function main() {
  console.log("Starting Mock USDC deployment to Base Sepolia...");
  
  // Get deployer account
  const [deployer]: SignerWithAddress[] = await ethers.getSigners();
  console.log(`Deploying Mock USDC with the account: ${deployer.address}`);
  
  const balance = await deployer.getBalance();
  console.log(`Account balance: ${ethers.utils.formatEther(balance)} ETH`);
  
  // Check if we're on Base Sepolia
  const network = await ethers.provider.getNetwork();
  console.log(`Network name: ${network.name}, chainId: ${network.chainId}`);
  
  if (network.chainId !== 84532) {
    console.warn("Warning: You're not on Base Sepolia! Expected chainId 84532");
    console.warn("Continuing anyway, but please check your network settings");
  }
  
  // Deploy Mock USDC
  console.log("Deploying MockERC20 as USDC...");
  const MockERC20Factory = (await ethers.getContractFactory("MockERC20")) as MockERC20__factory;
  const mockUsdc = await MockERC20Factory.deploy("USD Coin", "USDC", 6);
  await mockUsdc.deployed();
  
  const mockUsdcAddress = mockUsdc.address;
  console.log(`Mock USDC deployed to: ${mockUsdcAddress}`);
  
  // Mint a large amount of USDC to the deployer
  const mintAmount = ethers.utils.parseUnits("10000000", 6); // 10 million USDC
  console.log(`Minting ${ethers.utils.formatUnits(mintAmount, 6)} USDC to deployer...`);
  
  const mintTx = await mockUsdc.mint(deployer.address, mintAmount);
  await mintTx.wait();
  console.log(`Successfully minted USDC to ${deployer.address}`);
  
  // Verify deployer balance
  const deployerBalance = await mockUsdc.balanceOf(deployer.address);
  console.log(`Deployer USDC balance: ${ethers.utils.formatUnits(deployerBalance, 6)} USDC`);
  
  // Print verification command
  console.log("\n=== VERIFICATION INSTRUCTIONS ===");
  console.log("To verify your Mock USDC contract on Basescan, run:");
  console.log(`npx hardhat verify --network baseSepolia ${mockUsdcAddress} "USD Coin" "USDC" 6`);
  console.log("=================================");
  
  // Print update instructions for main deploy script
  console.log("\n=== DEPLOYMENT NEXT STEPS ===");
  console.log("1. Update your deploy.ts script with this Mock USDC address:");
  console.log(`const usdcAddress = "${mockUsdcAddress}";`);
  console.log("2. Deploy your AgentMerchant contract using:");
  console.log("npx hardhat run scripts/deploy.ts --network baseSepolia");
  console.log("============================");
  
  // Return deployed address
  return {
    network: network.name,
    chainId: network.chainId,
    mockUsdcAddress
  };
}

// Execute the deployment
main()
  .then((deployedAddresses) => {
    console.log("Mock USDC deployment successful:", deployedAddresses);
    process.exit(0);
  })
  .catch((error) => {
    console.error("Mock USDC deployment failed:", error);
    process.exit(1);
  }); 