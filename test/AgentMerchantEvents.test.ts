import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
  AgentMerchant,
  AgentToken,
  MockERC20,
  AgentMerchant__factory,
  MockERC20__factory
} from "../typechain-types";
import { Contract } from "ethers";

describe("AgentMerchant Events", function () {
  // Test variables
  let agentMerchant: AgentMerchant;
  let usdcToken: MockERC20;
  let creator: SignerWithAddress;
  let agent: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;

  // Test constants
  const INITIAL_USDC_SUPPLY = ethers.utils.parseUnits("1000000", 6); // 1 million USDC
  const USDC_DECIMALS = 6;
  const INITIAL_PRICE_PER_TOKEN = ethers.utils.parseUnits("1", 6); // 1 USDC
  const AGENT_NAME = "Test Agent";
  const AGENT_SYMBOL = "TAGENT";

  beforeEach(async function () {
    // Get signers
    [creator, agent, user1, user2] = await ethers.getSigners();

    // Deploy mock USDC token
    const MockERC20Factory = (await ethers.getContractFactory("MockERC20")) as MockERC20__factory;
    usdcToken = await MockERC20Factory.deploy("USD Coin", "USDC", USDC_DECIMALS);
    await usdcToken.deployed();

    // Mint USDC to users and agent
    await usdcToken.mint(agent.address, INITIAL_USDC_SUPPLY);
    await usdcToken.mint(user1.address, INITIAL_USDC_SUPPLY);
    await usdcToken.mint(user2.address, INITIAL_USDC_SUPPLY);

    // Deploy AgentMerchant contract
    const AgentMerchantFactory = (await ethers.getContractFactory("AgentMerchant")) as AgentMerchant__factory;
    agentMerchant = await AgentMerchantFactory.deploy(usdcToken.address);
    await agentMerchant.deployed();

    // Approve USDC for transfers
    await usdcToken.connect(agent).approve(agentMerchant.address, ethers.constants.MaxUint256);
    await usdcToken.connect(user1).approve(agentMerchant.address, ethers.constants.MaxUint256);
    await usdcToken.connect(user2).approve(agentMerchant.address, ethers.constants.MaxUint256);
  });

  describe("Event: AgentCreated", function () {
    it("should emit AgentCreated event with correct parameters", async function () {
      // Create agent and capture transaction
      const tx = await agentMerchant.connect(creator).createAgent(agent.address, AGENT_NAME, AGENT_SYMBOL);
      const receipt = await tx.wait();
      
      // Get agent info to extract the token address
      const agentInfo = await agentMerchant.agentInfoMapper(agent.address);
      const agentTokenAddress = agentInfo.stockTokenAddress;
      
      // Find and verify the AgentCreated event
      const event = receipt.events?.find(e => e.event === "AgentCreated");
      expect(event).to.not.be.undefined;
      
      // Check event parameters
      const eventArgs = event?.args;
      expect(eventArgs?.walletAddress).to.equal(agent.address);
      expect(eventArgs?.creatorAddress).to.equal(creator.address);
      expect(eventArgs?.stockTokenAddress).to.equal(agentTokenAddress);
      expect(eventArgs?.name).to.equal(AGENT_NAME);
      expect(eventArgs?.symbol).to.equal(AGENT_SYMBOL);
      expect(eventArgs?.initialPrice).to.equal(INITIAL_PRICE_PER_TOKEN);
    });
  });

  describe("Event: StockPurchased", function () {
    let agentTokenAddress: string;
    
    beforeEach(async function () {
      // Create agent first
      await agentMerchant.connect(creator).createAgent(agent.address, AGENT_NAME, AGENT_SYMBOL);
      
      // Get agent token address
      const agentInfo = await agentMerchant.agentInfoMapper(agent.address);
      agentTokenAddress = agentInfo.stockTokenAddress;
    });
    
    it("should emit StockPurchased event with correct parameters", async function () {
      const purchaseAmount = 100; // 100 tokens
      const expectedUsdcAmount = ethers.BigNumber.from(purchaseAmount).mul(INITIAL_PRICE_PER_TOKEN);
      
      // Purchase stock and capture transaction
      const tx = await agentMerchant.connect(user1).purchaseStock(agentTokenAddress, purchaseAmount);
      const receipt = await tx.wait();
      
      // Find and verify the StockPurchased event
      const event = receipt.events?.find(e => e.event === "StockPurchased");
      expect(event).to.not.be.undefined;
      
      // Check event parameters
      const eventArgs = event?.args;
      expect(eventArgs?.buyer).to.equal(user1.address);
      expect(eventArgs?.agentWalletAddress).to.equal(agent.address);
      expect(eventArgs?.stockTokenAddress).to.equal(agentTokenAddress);
      expect(eventArgs?.tokenAmount).to.equal(purchaseAmount);
      expect(eventArgs?.usdcAmount).to.equal(expectedUsdcAmount);
    });
  });

  describe("Event: SellStockRequested", function () {
    let agentTokenAddress: string;
    
    beforeEach(async function () {
      // Create agent
      await agentMerchant.connect(creator).createAgent(agent.address, AGENT_NAME, AGENT_SYMBOL);
      
      // Get agent token address
      const agentInfo = await agentMerchant.agentInfoMapper(agent.address);
      agentTokenAddress = agentInfo.stockTokenAddress;
      
      // User purchases tokens
      await agentMerchant.connect(user1).purchaseStock(agentTokenAddress, 100);
    });
    
    it("should emit SellStockRequested event with correct parameters", async function () {
      const sellAmount = 40; // 40 tokens
      
      // Commit to sell tokens and capture transaction
      const tx = await agentMerchant.connect(user1).commitSellStock(agentTokenAddress, sellAmount);
      const receipt = await tx.wait();
      
      // Find and verify the SellStockRequested event
      const event = receipt.events?.find(e => e.event === "SellStockRequested");
      expect(event).to.not.be.undefined;
      
      // Check event parameters
      const eventArgs = event?.args;
      expect(eventArgs?.seller).to.equal(user1.address);
      expect(eventArgs?.stockTokenAddress).to.equal(agentTokenAddress);
      expect(eventArgs?.tokenAmount).to.equal(sellAmount);
    });
  });

  describe("Events: SellRequestFulfilled and PricePerTokenUpdated", function () {
    let agentTokenAddress: string;
    
    beforeEach(async function () {
      // Create agent
      await agentMerchant.connect(creator).createAgent(agent.address, AGENT_NAME, AGENT_SYMBOL);
      
      // Get agent token address
      const agentInfo = await agentMerchant.agentInfoMapper(agent.address);
      agentTokenAddress = agentInfo.stockTokenAddress;
      
      // User purchases tokens
      await agentMerchant.connect(user1).purchaseStock(agentTokenAddress, 100);
      
      // User commits to sell tokens
      await agentMerchant.connect(user1).commitSellStock(agentTokenAddress, 40);
    });
    
    it("should emit SellRequestFulfilled and PricePerTokenUpdated events", async function () {
      // Get initial price for comparison
      const initialAgentInfo = await agentMerchant.agentInfoMapper(agent.address);
      const initialPrice = initialAgentInfo.pricePerToken;
      
      // Fulfill sell requests and capture transaction
      const tx = await agentMerchant.connect(agent).fullfillSellStock();
      const receipt = await tx.wait();
      
      // Get updated agent info for new price
      const updatedAgentInfo = await agentMerchant.agentInfoMapper(agent.address);
      const newPrice = updatedAgentInfo.pricePerToken;
      
      // Find and verify the SellRequestFulfilled event
      const fulfillEvent = receipt.events?.find(e => e.event === "SellRequestFulfilled");
      expect(fulfillEvent).to.not.be.undefined;
      
      // Check SellRequestFulfilled event parameters
      const fulfillEventArgs = fulfillEvent?.args;
      expect(fulfillEventArgs?.agentWalletAddress).to.equal(agent.address);
      expect(fulfillEventArgs?.stockTokenAddress).to.equal(agentTokenAddress);
      expect(fulfillEventArgs?.totalTokenAmount).to.equal(40); // The sell amount
      expect(fulfillEventArgs?.newPricePerToken).to.equal(newPrice);
      
      // Calculate expected total USDC paid
      const expectedTotalUsdcPaid = ethers.BigNumber.from(40).mul(newPrice);
      expect(fulfillEventArgs?.totalUsdcPaid).to.equal(expectedTotalUsdcPaid);
      
      // Find and verify the PricePerTokenUpdated event
      const priceEvent = receipt.events?.find(e => e.event === "PricePerTokenUpdated");
      expect(priceEvent).to.not.be.undefined;
      
      // Check PricePerTokenUpdated event parameters
      const priceEventArgs = priceEvent?.args;
      expect(priceEventArgs?.agentWalletAddress).to.equal(agent.address);
      expect(priceEventArgs?.oldPricePerToken).to.equal(initialPrice);
      expect(priceEventArgs?.newPricePerToken).to.equal(newPrice);
    });
  });

  describe("Event: UsdcTokenAddressUpdated", function () {
    it("should emit UsdcTokenAddressUpdated event with correct parameters", async function () {
      // Deploy a new USDC token to update to
      const MockERC20Factory = (await ethers.getContractFactory("MockERC20")) as MockERC20__factory;
      const newUsdcToken = await MockERC20Factory.deploy("New USD Coin", "NUSDC", USDC_DECIMALS);
      await newUsdcToken.deployed();
      
      // Get original USDC token address
      const originalUsdcAddress = await agentMerchant.usdcToken();
      
      // Update USDC token address and capture transaction
      const tx = await agentMerchant.connect(creator).updateUsdcTokenAddress(newUsdcToken.address);
      const receipt = await tx.wait();
      
      // Find and verify the UsdcTokenAddressUpdated event
      const event = receipt.events?.find(e => e.event === "UsdcTokenAddressUpdated");
      expect(event).to.not.be.undefined;
      
      // Check event parameters
      const eventArgs = event?.args;
      expect(eventArgs?.oldAddress).to.equal(originalUsdcAddress);
      expect(eventArgs?.newAddress).to.equal(newUsdcToken.address);
      
      // Verify the contract state was updated
      const updatedUsdcAddress = await agentMerchant.usdcToken();
      expect(updatedUsdcAddress).to.equal(newUsdcToken.address);
    });
    
    it("should revert when non-owner tries to update USDC address", async function () {
      // Deploy a new USDC token
      const MockERC20Factory = (await ethers.getContractFactory("MockERC20")) as MockERC20__factory;
      const newUsdcToken = await MockERC20Factory.deploy("New USD Coin", "NUSDC", USDC_DECIMALS);
      await newUsdcToken.deployed();
      
      // Attempt to update USDC token address from non-owner account
      await expect(
        agentMerchant.connect(user1).updateUsdcTokenAddress(newUsdcToken.address)
      ).to.be.revertedWith("Only owner can call this function");
    });
    
    it("should revert when attempting to update to zero address", async function () {
      // Attempt to update USDC token address to zero address
      await expect(
        agentMerchant.connect(creator).updateUsdcTokenAddress(ethers.constants.AddressZero)
      ).to.be.revertedWith("Invalid token address");
    });
  });
}); 