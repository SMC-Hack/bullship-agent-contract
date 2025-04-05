import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { MockERC20, MockERC20__factory, AgentMerchant } from "../typechain-types";

async function main() {
  console.log("Starting Deployment...");
  
  // Get deployer account
  const [deployer]: SignerWithAddress[] = await ethers.getSigners();
  console.log(`Deploying contracts with the account: ${deployer.address}`);
  
  const balance = await deployer.getBalance();
  console.log(`Account balance: ${ethers.utils.formatEther(balance)} ETH`);
  
  // Check network
  const network = await ethers.provider.getNetwork();
  console.log(`Network name: ${network.name}, chainId: ${network.chainId}`);
  
  // STEP 1: Deploy Mock USDC
  console.log("\n==== STEP 1: Deploying Mock USDC ====");
  const MockERC20Factory = (await ethers.getContractFactory("MockERC20")) as MockERC20__factory;
  const mockUsdc = await MockERC20Factory.deploy("USD Coin", "USDC", 6);
  await mockUsdc.deployed();
  
  const mockUsdcAddress = mockUsdc.address;
  console.log(`Mock USDC deployed to: ${mockUsdcAddress}`);
  
  // Mint a large amount of USDC to the deployer
  const mintAmount = ethers.utils.parseUnits("10000", 6); // 10000 USDC
  console.log(`Minting ${ethers.utils.formatUnits(mintAmount, 6)} USDC to deployer...`);
  
  const mintTx = await mockUsdc.mint(deployer.address, mintAmount);
  await mintTx.wait();
  console.log(`Successfully minted USDC to ${deployer.address}`);
  
  // Define Message Transmitter address
  console.log("\n==== Setting up Message Transmitter ====");
  // For testnet, you'll need the actual Circle Message Transmitter contract address
  // This is a placeholder - REPLACE WITH ACTUAL ADDRESS
  const messageTransmitterAddress = "0xe737e5cebeeba77efe34d4aa090756590b1ce275";
  console.log(`Using message transmitter address: ${messageTransmitterAddress}`);
  
  // STEP 2: Deploy AgentMerchant with temporary wrapper address
  console.log("\n==== STEP 2: Deploying AgentMerchant ====");
  const AgentMerchantFactory = await ethers.getContractFactory("AgentMerchant");
  // Using deployer address as owner and a temporary placeholder for the wrapper
  const agentMerchant = await AgentMerchantFactory.deploy(
    mockUsdcAddress,
    deployer.address
  );
  await agentMerchant.deployed();
  console.log(`AgentMerchant deployed to: ${agentMerchant.address}`);
  
  // STEP 3: Deploy CircleMerchantWrapper
  console.log("\n==== STEP 3: Deploying CircleMerchantWrapper ====");
  const CCTPWrapperFactory = await ethers.getContractFactory("CCTPHookWrapper");
  const cctpWrapper = await CCTPWrapperFactory.deploy(
    messageTransmitterAddress,
    agentMerchant.address,
    mockUsdcAddress
  );
  await cctpWrapper.deployed();
  console.log(`CircleMerchantWrapper deployed to: ${cctpWrapper.address}`);
  
  // STEP 4: Update AgentMerchant with the CircleMerchantWrapper address
  console.log("\n==== STEP 4: Updating AgentMerchant with CircleMerchantWrapper ====");
  try {
    const updateTx = await agentMerchant.updateCctpWrapperAddress(cctpWrapper.address);
    await updateTx.wait();
    console.log(`Successfully updated AgentMerchant with CircleMerchantWrapper address`);
  } catch (error) {
    console.error("Failed to update CircleMerchantWrapper address:", error);
    throw error;
  }
  
  // Verification instructions
  console.log("\n==== Verification Instructions ====");
  console.log("To verify Mock USDC:");
  console.log(`npx hardhat verify --network ${network.name} ${mockUsdcAddress} "USD Coin" "USDC" 6`);
  
  console.log("\nTo verify AgentMerchant:");
  console.log(`npx hardhat verify --network ${network.name} ${agentMerchant.address} ${mockUsdcAddress} ${deployer.address}`);
  
  console.log("\nTo verify CircleMerchantWrapper:");
  console.log(`npx hardhat verify --network ${network.name} ${cctpWrapper.address} ${messageTransmitterAddress} ${agentMerchant.address} ${mockUsdcAddress}`);
  
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