import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { MockERC20, MockERC20__factory, AgentMerchant } from "../typechain-types";

async function main() {
  console.log("Starting CCTP-Integrated Deployment to Base Sepolia...");
  
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
  
  // STEP 1: Deploy Mock USDC
  console.log("\n==== STEP 1: Deploying Mock USDC ====");
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
  
  // STEP 2: Define or Retrieve Message Transmitter Address
  console.log("\n==== STEP 2: Setting up Message Transmitter ====");
  // For Base Sepolia, you'd need the actual Circle Message Transmitter contract address
  // This is just a placeholder - REPLACE WITH ACTUAL ADDRESS
  const messageTransmitterAddress = "0x0000000000000000000000000000000000000000";
  console.log(`Using message transmitter address: ${messageTransmitterAddress}`);
  
  // Ask for confirmation if this is just a placeholder
  if (messageTransmitterAddress === "0x0000000000000000000000000000000000000000") {
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    console.warn("WARNING: You're using a zero address for the message transmitter!");
    console.warn("This should be replaced with the actual Circle CCTP Message Transmitter address");
    
    const answer = await new Promise<string>(resolve => {
      readline.question('Continue with deployment anyway? (y/n): ', resolve);
    });
    readline.close();
    
    if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
      console.log("Deployment aborted.");
      process.exit(0);
    }
  }
  
  // STEP 3: Deploy CCTPHookWrapper first as a placeholder
  // This is needed because AgentMerchant requires the wrapper address
  console.log("\n==== STEP 3: Deploying Placeholder CCTPHookWrapper ====");
  const placeholderCCTPWrapper = await ethers.getContractFactory("CCTPHookWrapper");
  // We'll deploy with real addresses but we'll have to replace this contract later
  const placeholderWrapper = await placeholderCCTPWrapper.deploy(
    messageTransmitterAddress,
    "0x0000000000000000000000000000000000000001", // Temporary placeholder for AgentMerchant
    mockUsdcAddress
  );
  await placeholderWrapper.deployed();
  console.log(`Placeholder CCTPHookWrapper deployed to: ${placeholderWrapper.address}`);
  
  // STEP 4: Deploy AgentMerchant
  console.log("\n==== STEP 4: Deploying AgentMerchant ====");
  const AgentMerchantFactory = await ethers.getContractFactory("AgentMerchant");
  const agentMerchant = await AgentMerchantFactory.deploy(
    mockUsdcAddress,
    placeholderWrapper.address // Using the placeholder wrapper address
  );
  await agentMerchant.deployed();
  console.log(`AgentMerchant deployed to: ${agentMerchant.address}`);
  
  // STEP 5: Deploy the real CCTPHookWrapper with correct addresses
  console.log("\n==== STEP 5: Deploying Real CCTPHookWrapper ====");
  const CCTPWrapperFactory = await ethers.getContractFactory("CCTPHookWrapper");
  const cctpWrapper = await CCTPWrapperFactory.deploy(
    messageTransmitterAddress,
    agentMerchant.address,
    mockUsdcAddress
  );
  await cctpWrapper.deployed();
  console.log(`Real CCTPHookWrapper deployed to: ${cctpWrapper.address}`);
  
  // STEP 6: Update AgentMerchant with the real CCTPHookWrapper address
  console.log("\n==== STEP 6: Updating AgentMerchant with Real CCTPHookWrapper ====");
  // This assumes you have an updateCCTPWrapperAddress function in your AgentMerchant contract
  // If not, you'll need to deploy a new AgentMerchant with the correct address
  try {
    const updateTx = await agentMerchant.updateCctpWrapperAddress(cctpWrapper.address);
    await updateTx.wait();
    console.log(`Successfully updated AgentMerchant with real CCTPHookWrapper address`);
  } catch (error) {
    console.error("Failed to update CCTPHookWrapper address. You may need to redeploy AgentMerchant.");
    console.error("Error:", error);
  }
  
  // STEP 7: Verify all deployed contracts
  console.log("\n==== STEP 7: Verification Instructions ====");
  console.log("To verify Mock USDC:");
  console.log(`npx hardhat verify --network baseSepolia ${mockUsdcAddress} "USD Coin" "USDC" 6`);
  
  console.log("\nTo verify AgentMerchant:");
  console.log(`npx hardhat verify --network baseSepolia ${agentMerchant.address} ${mockUsdcAddress} ${cctpWrapper.address}`);
  
  console.log("\nTo verify CCTPHookWrapper:");
  console.log(`npx hardhat verify --network baseSepolia ${cctpWrapper.address} ${messageTransmitterAddress} ${agentMerchant.address} ${mockUsdcAddress}`);
  
  // Return all deployed contract addresses
  return {
    network: network.name,
    chainId: network.chainId,
    mockUsdc: mockUsdcAddress,
    agentMerchant: agentMerchant.address,
    cctpWrapper: cctpWrapper.address,
    messageTransmitter: messageTransmitterAddress
  };
}

// Execute the deployment
main()
  .then((deployedAddresses) => {
    console.log("\n==== Deployment Summary ====");
    console.log("All contracts successfully deployed!");
    console.log("Deployed addresses:", deployedAddresses);
    process.exit(0);
  })
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  }); 