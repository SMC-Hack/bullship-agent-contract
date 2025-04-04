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

describe("AgentMerchant", function () {
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

  describe("createAgent", function () {
    it("should create a new agent token with correct parameters", async function () {
      // Create agent
      await agentMerchant.connect(creator).createAgent(agent.address, AGENT_NAME, AGENT_SYMBOL);

      // Get agent info
      const agentInfo = await agentMerchant.agentInfoMapper(agent.address);

      // Verify agent info
      expect(agentInfo.walletAddress).to.equal(agent.address);
      expect(agentInfo.pricePerToken).to.equal(INITIAL_PRICE_PER_TOKEN);
      expect(agentInfo.creatorAddress).to.equal(creator.address);

      // Verify mappings
      const creatorAgents = await agentMerchant.creatorAddressToAgentWalletAddressesMapper(creator.address, 0);
      expect(creatorAgents).to.equal(agent.address);

      const tokenWalletMap = await agentMerchant.stockTokenToWalletAddressMapper(agentInfo.stockTokenAddress);
      expect(tokenWalletMap).to.equal(agent.address);
    });

    it("should revert if agent wallet already exists", async function () {
      // Create agent first time
      await agentMerchant.connect(creator).createAgent(agent.address, AGENT_NAME, AGENT_SYMBOL);

      // Try to create agent with same wallet address - should revert
      await expect(
        agentMerchant.connect(creator).createAgent(agent.address, "Another Agent", "AAGT")
      ).to.be.revertedWith("Agent wallet address already exists");
    });
  });

  describe("purchaseStock", function () {
    let agentTokenAddress: string;

    beforeEach(async function () {
      // Create agent first
      await agentMerchant.connect(creator).createAgent(agent.address, AGENT_NAME, AGENT_SYMBOL);

      // Get agent token address
      const agentInfo = await agentMerchant.agentInfoMapper(agent.address);
      agentTokenAddress = agentInfo.stockTokenAddress;
    });

    it("should allow users to purchase agent tokens", async function () {
      const purchaseAmount = 100; // 100 tokens with 0 decimals
      const expectedUsdcAmount = purchaseAmount * Number(ethers.utils.formatUnits(INITIAL_PRICE_PER_TOKEN, 6));
      const expectedUsdcAmountBN = ethers.utils.parseUnits(expectedUsdcAmount.toString(), 6);

      // Get balances before purchase
      const userUsdcBefore = await usdcToken.balanceOf(user1.address);
      const agentUsdcBefore = await usdcToken.balanceOf(agent.address);

      // Purchase tokens
      await agentMerchant.connect(user1).purchaseStock(agentTokenAddress, purchaseAmount);

      // Check user received correct amount of agent tokens
      const agentTokenContract = await ethers.getContractAt("AgentToken", agentTokenAddress) as Contract;
      const userTokenBalance = await agentTokenContract.balanceOf(user1.address);
      expect(userTokenBalance).to.equal(purchaseAmount);

      // Check USDC was transferred correctly
      const userUsdcAfter = await usdcToken.balanceOf(user1.address);
      const agentUsdcAfter = await usdcToken.balanceOf(agent.address);

      expect(userUsdcBefore.sub(userUsdcAfter)).to.equal(expectedUsdcAmountBN);
      expect(agentUsdcAfter.sub(agentUsdcBefore)).to.equal(expectedUsdcAmountBN);
    });

    it("should revert if user doesn't have enough USDC", async function () {
      // Create a user with 0 USDC
      const poorUser = (await ethers.getSigners())[5];

      // Try to purchase tokens - should revert
      await expect(
        agentMerchant.connect(poorUser).purchaseStock(agentTokenAddress, 100)
      ).to.be.revertedWith("User does not have enough usdc to purchase shares");
    });
  });

  describe("commitSellStock", function () {
    let agentTokenAddress: string;
    let agentToken: Contract;
    const purchaseAmount = 100; // 100 tokens with 0 decimals

    beforeEach(async function () {
      // Create agent
      await agentMerchant.connect(creator).createAgent(agent.address, AGENT_NAME, AGENT_SYMBOL);

      // Get agent token address
      const agentInfo = await agentMerchant.agentInfoMapper(agent.address);
      agentTokenAddress = agentInfo.stockTokenAddress;

      // Get agent token contract
      agentToken = await ethers.getContractAt("AgentToken", agentTokenAddress);

      // User purchases tokens
      await agentMerchant.connect(user1).purchaseStock(agentTokenAddress, purchaseAmount);
    });

    it("should burn tokens and create a sell request", async function () {
      const sellAmount = 40; // 40 tokens

      // Get token balance before selling
      const userTokenBalanceBefore = await agentToken.balanceOf(user1.address);

      // Commit to sell tokens
      await agentMerchant.connect(user1).commitSellStock(agentTokenAddress, sellAmount);

      // Check tokens were burned (balance reduced)
      const userTokenBalanceAfter = await agentToken.balanceOf(user1.address);
      expect(userTokenBalanceBefore.sub(userTokenBalanceAfter)).to.equal(sellAmount);

      // Check sell request was created
      const sellRequests = await agentMerchant.sellShareRequests(agentTokenAddress, 0);
      expect(sellRequests.userWalletAddress).to.equal(user1.address);
      expect(sellRequests.tokenAmount).to.equal(sellAmount);
    });

    it("should update existing sell request if one already exists", async function () {
      // Sell first batch
      const sellAmount1 = 30;
      await agentMerchant.connect(user1).commitSellStock(agentTokenAddress, sellAmount1);

      // Sell second batch
      const sellAmount2 = 20;
      await agentMerchant.connect(user1).commitSellStock(agentTokenAddress, sellAmount2);

      // Check sell request was updated
      const sellRequests = await agentMerchant.sellShareRequests(agentTokenAddress, 0);
      expect(sellRequests.userWalletAddress).to.equal(user1.address);
      expect(sellRequests.tokenAmount).to.equal(sellAmount1 + sellAmount2);
    });
  });

  describe("fullfillSellStock", function () {
    let agentTokenAddress: string;
    let agentToken: Contract;
    const purchaseAmount = 100; // 100 tokens with 0 decimals
    const sellAmount = 40; // 40 tokens

    beforeEach(async function () {
      // Create agent
      await agentMerchant.connect(creator).createAgent(agent.address, AGENT_NAME, AGENT_SYMBOL);

      // Get agent token address
      const agentInfo = await agentMerchant.agentInfoMapper(agent.address);
      agentTokenAddress = agentInfo.stockTokenAddress;

      // Get agent token contract
      agentToken = await ethers.getContractAt("AgentToken", agentTokenAddress);

      // User purchases tokens
      await agentMerchant.connect(user1).purchaseStock(agentTokenAddress, purchaseAmount);

      // User commits to sell tokens
      await agentMerchant.connect(user1).commitSellStock(agentTokenAddress, sellAmount);
    });

    it("should pay back USDC to users who sold tokens", async function () {
      // Get balances before fulfilling
      const userUsdcBefore = await usdcToken.balanceOf(user1.address);
      const agentUsdcBefore = await usdcToken.balanceOf(agent.address);

      // Fulfill sell requests
      await agentMerchant.connect(agent).fullfillSellStock();

      // Calculate expected payout
      const agentInfo = await agentMerchant.agentInfoMapper(agent.address);
      const expectedPayout = ethers.BigNumber.from(sellAmount).mul(agentInfo.pricePerToken);


      // Check USDC was transferred correctly
      const userUsdcAfter = await usdcToken.balanceOf(user1.address);
      const agentUsdcAfter = await usdcToken.balanceOf(agent.address);


      expect(userUsdcAfter.sub(userUsdcBefore)).to.equal(expectedPayout);
      expect(agentUsdcBefore.sub(agentUsdcAfter)).to.equal(expectedPayout);

      // Check sell requests were cleared
      const sellRequestsLength = await agentMerchant.getSellShareRequestsLength(agentTokenAddress);
      expect(sellRequestsLength).to.equal(0);
    });

    it("should update the price per token after fulfilling sell requests", async function () {
      // Get original price
      let agentInfo = await agentMerchant.agentInfoMapper(agent.address);
      const originalPrice = agentInfo.pricePerToken;

      // Fulfill sell requests
      await agentMerchant.connect(agent).fullfillSellStock();

      // Get new price
      agentInfo = await agentMerchant.agentInfoMapper(agent.address);
      const newPrice = agentInfo.pricePerToken;

      // Price should be different after fulfilling
      expect(newPrice).to.not.equal(originalPrice);
    });
  });
}); 