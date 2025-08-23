import { expect } from "chai";
import { ethers } from "hardhat";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { BigNumber, ContractFactory } from "ethers";
import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { MockERC20, TradeSettlement } from "../typechain-types";

describe("TradeSettlement", function () {
    let tradeSettlement: TradeSettlement;
    let baseToken: MockERC20;
    let quoteToken: MockERC20;
    let owner: SignerWithAddress, trader1: SignerWithAddress, trader2: SignerWithAddress, other: SignerWithAddress;

    const INITIAL_SUPPLY = ethers.utils.parseEther("1000000");
    const TRADE_AMOUNT = ethers.utils.parseEther("100");
    const PRICE = ethers.utils.parseEther("1.5"); // 1.5 quote tokens per base token

    beforeEach(async function () {
        [owner, trader1, trader2, other] = await ethers.getSigners();

        // Deploy mock ERC20 tokens
        const MockERC20Factory: ContractFactory = await ethers.getContractFactory("MockERC20");
        baseToken = (await MockERC20Factory.deploy("Base Token", "BASE", INITIAL_SUPPLY)) as MockERC20;
        await baseToken.deployed();

        quoteToken = (await MockERC20Factory.deploy("Quote Token", "QUOTE", INITIAL_SUPPLY)) as MockERC20;
        await quoteToken.deployed();

        // Deploy TradeSettlement contract
        const TradeSettlementFactory: ContractFactory = await ethers.getContractFactory("TradeSettlement");
        tradeSettlement = (await TradeSettlementFactory.deploy()) as TradeSettlement;
        await tradeSettlement.deployed();

        // Transfer tokens to traders
        await baseToken.transfer(trader1.address, ethers.utils.parseEther("10000"));
        await baseToken.transfer(trader2.address, ethers.utils.parseEther("10000"));
        await quoteToken.transfer(trader1.address, ethers.utils.parseEther("10000"));
        await quoteToken.transfer(trader2.address, ethers.utils.parseEther("10000"));

        // Approve tokens for settlement contract
        await baseToken.connect(trader1).approve(tradeSettlement.address, ethers.constants.MaxUint256);
        await baseToken.connect(trader2).approve(tradeSettlement.address, ethers.constants.MaxUint256);
        await quoteToken.connect(trader1).approve(tradeSettlement.address, ethers.constants.MaxUint256);
        await quoteToken.connect(trader2).approve(tradeSettlement.address, ethers.constants.MaxUint256);
    });

    describe("Deployment", function () {
        it("Should set the right owner", async function () {
            expect(await tradeSettlement.owner()).to.equal(owner.address);
        });
    });

    describe("Allowance and Balance Checks", function () {
        it("Should check allowances correctly", async function () {
            const [sufficient, allowance]: [boolean, BigNumber] = await tradeSettlement.checkAllowance(
                trader1.address,
                baseToken.address,
                TRADE_AMOUNT
            );

            expect(sufficient).to.be.true;
            expect(allowance).to.equal(ethers.constants.MaxUint256);
        });

        it("Should check balances correctly", async function () {
            const [sufficient, balance]: [boolean, BigNumber] = await tradeSettlement.checkBalance(
                trader1.address,
                baseToken.address,
                TRADE_AMOUNT
            );

            expect(sufficient).to.be.true;
            expect(balance).to.equal(ethers.utils.parseEther("10000"));
        });

        it("Should batch check allowances", async function () {
            const users = [trader1.address, trader2.address];
            const tokens = [baseToken.address, quoteToken.address];
            const amounts = [TRADE_AMOUNT, TRADE_AMOUNT];

            const [sufficient, allowances]: [boolean[], BigNumber[]] = await tradeSettlement.batchCheckAllowances(
                users,
                tokens,
                amounts
            );

            expect(sufficient[0]).to.be.true;
            expect(sufficient[1]).to.be.true;
            expect(allowances[0]).to.equal(ethers.constants.MaxUint256);
            expect(allowances[1]).to.equal(ethers.constants.MaxUint256);
        });

        it("Should revert batch check with mismatched arrays", async function () {
            const users = [trader1.address];
            const tokens = [baseToken.address, quoteToken.address];
            const amounts = [TRADE_AMOUNT];

            await expect(
                tradeSettlement.batchCheckAllowances(users, tokens, amounts)
            ).to.be.revertedWith("Array lengths mismatch");
        });
    });

    describe("Signature Verification", function () {
        it("Should verify trade signatures correctly", async function () {
            const orderId = 1;
            const quantity = TRADE_AMOUNT;
            const side = "bid";
            const timestamp = Math.floor(Date.now() / 1000);
            const nonce = 0;

            // Create message hash (matches contract's abi.encode usage)
            const messageHash = ethers.utils.solidityKeccak256(
                ["uint256", "address", "address", "uint256", "uint256", "string", "uint256", "uint256"],
                [orderId, baseToken.address, quoteToken.address, PRICE, quantity, side, timestamp, nonce]
            );

            // Sign the message
            const signature = await trader1.signMessage(ethers.utils.arrayify(messageHash));

            const isValid: boolean = await tradeSettlement.verifyTradeSignature(
                trader1.address,
                orderId,
                baseToken.address,
                quoteToken.address,
                PRICE,
                quantity,
                side,
                timestamp,
                nonce,
                signature
            );

            expect(isValid).to.be.true;
        });

        it("Should reject invalid signatures", async function () {
            const orderId = 1;
            const quantity = TRADE_AMOUNT;
            const side = "bid";
            const timestamp = Math.floor(Date.now() / 1000);
            const nonce = 0;

            const messageHash = ethers.utils.solidityKeccak256(
                ["uint256", "address", "address", "uint256", "uint256", "string", "uint256", "uint256"],
                [orderId, baseToken.address, quoteToken.address, PRICE, quantity, side, timestamp, nonce]
            );

            // Sign with wrong signer
            const signature = await trader2.signMessage(ethers.utils.arrayify(messageHash));

            const isValid: boolean = await tradeSettlement.verifyTradeSignature(
                trader1.address, // Claiming trader1 signed it
                orderId,
                baseToken.address,
                quoteToken.address,
                PRICE,
                quantity,
                side,
                timestamp,
                nonce,
                signature // But trader2 actually signed
            );

            expect(isValid).to.be.false;
        });
    });

    describe("Trade Settlement", function () {
        let tradeData: any, signature1: string, signature2: string;
        const orderId = 1;
        const timestamp = Math.floor(Date.now() / 1000);
        const nonce1 = 0;
        const nonce2 = 0;
        const party1Side = "bid";
        const party2Side = "ask";

        beforeEach(async function () {
            // Create trade data
            tradeData = {
                orderId: orderId,
                account: trader1.address,
                price: PRICE,
                quantity: TRADE_AMOUNT,
                side: party1Side,
                baseAsset: baseToken.address,
                quoteAsset: quoteToken.address,
                tradeId: "trade123",
                timestamp: timestamp,
                isValid: true
            };

            // Create signatures
            const messageHash1 = ethers.utils.solidityKeccak256(
                ["uint256", "address", "address", "uint256", "uint256", "string", "uint256", "uint256"],
                [orderId, baseToken.address, quoteToken.address, PRICE, TRADE_AMOUNT, party1Side, timestamp, nonce1]
            );

            const messageHash2 = ethers.utils.solidityKeccak256(
                ["uint256", "address", "address", "uint256", "uint256", "string", "uint256", "uint256"],
                [orderId, baseToken.address, quoteToken.address, PRICE, TRADE_AMOUNT, party2Side, timestamp, nonce2]
            );

            signature1 = await trader1.signMessage(ethers.utils.arrayify(messageHash1));
            signature2 = await trader2.signMessage(ethers.utils.arrayify(messageHash2));
        });

        it("Should settle a valid trade", async function () {
            const trader1BaseBalanceBefore: BigNumber = await baseToken.balanceOf(trader1.address);
            const trader1QuoteBalanceBefore: BigNumber = await quoteToken.balanceOf(trader1.address);
            const trader2BaseBalanceBefore: BigNumber = await baseToken.balanceOf(trader2.address);
            const trader2QuoteBalanceBefore: BigNumber = await quoteToken.balanceOf(trader2.address);
            await expect(
                tradeSettlement.settleTrade(
                    tradeData,
                    trader1.address,
                    trader2.address,
                    TRADE_AMOUNT,
                    TRADE_AMOUNT,
                    party1Side,
                    party2Side,
                    signature1,
                    signature2,
                    nonce1,
                    nonce2
                )
            ).to.emit(tradeSettlement, "TradeSettled")

            console.log("GOT HERE")


            // Check balances after trade
            const quoteAmount: BigNumber = TRADE_AMOUNT.mul(PRICE).div(ethers.utils.parseEther("1"));

            expect(await baseToken.balanceOf(trader1.address))
                .to.equal(trader1BaseBalanceBefore.add(TRADE_AMOUNT));

            expect(await quoteToken.balanceOf(trader1.address))
                .to.equal(trader1QuoteBalanceBefore.sub(quoteAmount));

            expect(await baseToken.balanceOf(trader2.address))
                .to.equal(trader2BaseBalanceBefore.sub(TRADE_AMOUNT));

            expect(await quoteToken.balanceOf(trader2.address))
                .to.equal(trader2QuoteBalanceBefore.add(quoteAmount));

            // Check nonces were updated
            expect(await tradeSettlement.getUserNonce(trader1.address, baseToken.address)).to.equal(1);
            expect(await tradeSettlement.getUserNonce(trader2.address, baseToken.address)).to.equal(1);
        });

        it("Should prevent replay attacks", async function () {
            // Execute trade once
            await tradeSettlement.settleTrade(
                tradeData,
                trader1.address,
                trader2.address,
                TRADE_AMOUNT,
                TRADE_AMOUNT,
                party1Side,
                party2Side,
                signature1,
                signature2,
                nonce1,
                nonce2
            );

            // Try to execute the same trade again
            await expect(
                tradeSettlement.settleTrade(
                    tradeData,
                    trader1.address,
                    trader2.address,
                    TRADE_AMOUNT,
                    TRADE_AMOUNT,
                    party1Side,
                    party2Side,
                    signature1,
                    signature2,
                    nonce1,
                    nonce2
                )
            ).to.be.revertedWith("Trade already executed");
        });

        it("Should reject invalid trade data", async function () {
            const invalidTradeData = { ...tradeData, isValid: false };

            await expect(
                tradeSettlement.settleTrade(
                    invalidTradeData,
                    trader1.address,
                    trader2.address,
                    TRADE_AMOUNT,
                    TRADE_AMOUNT,
                    party1Side,
                    party2Side,
                    signature1,
                    signature2,
                    nonce1,
                    nonce2
                )
            ).to.be.revertedWith("Trade is not valid");
        });

        it("Should reject invalid signatures", async function () {
            const wrongSignature = await other.signMessage("wrong message");

            await expect(
                tradeSettlement.settleTrade(
                    tradeData,
                    trader1.address,
                    trader2.address,
                    TRADE_AMOUNT,
                    TRADE_AMOUNT,
                    party1Side,
                    party2Side,
                    wrongSignature,
                    signature2,
                    nonce1,
                    nonce2
                )
            ).to.be.revertedWith("Invalid party1 signature");
        });

        it("Should reject trades with insufficient allowance", async function () {
            // Reduce allowance
            await baseToken.connect(trader2).approve(tradeSettlement.address, TRADE_AMOUNT.div(2));

            await expect(
                tradeSettlement.settleTrade(
                    tradeData,
                    trader1.address,
                    trader2.address,
                    TRADE_AMOUNT,
                    TRADE_AMOUNT,
                    party1Side,
                    party2Side,
                    signature1,
                    signature2,
                    nonce1,
                    nonce2
                )
            ).to.be.revertedWith("Insufficient base asset allowance");
        });

        it("Should reject trades with insufficient balance", async function () {
            // Transfer away most tokens
            const balance = await baseToken.balanceOf(trader2.address);
            await baseToken.connect(trader2).transfer(other.address, balance.sub(TRADE_AMOUNT.div(2)));

            await expect(
                tradeSettlement.settleTrade(
                    tradeData,
                    trader1.address,
                    trader2.address,
                    TRADE_AMOUNT,
                    TRADE_AMOUNT,
                    party1Side,
                    party2Side,
                    signature1,
                    signature2,
                    nonce1,
                    nonce2
                )
            ).to.be.revertedWith("Insufficient base asset balance");
        });
    });

    // describe("Emergency Recovery", function () {
    //     it("Should allow owner to recover stuck tokens", async function () {
    //         // Send some tokens to the contract
    //         await baseToken.transfer(tradeSettlement.address, TRADE_AMOUNT);

    //         await expect(
    //             tradeSettlement.emergencyRecoverToken(
    //                 baseToken.address,
    //                 owner.address,
    //                 TRADE_AMOUNT
    //             )
    //         ).not.to.be.reverted;

    //         expect(await baseToken.balanceOf(owner.address))
    //             .to.equal(INITIAL_SUPPLY.sub(ethers.utils.parseEther("20000")).add(TRADE_AMOUNT));
    //     });

    //     it("Should reject emergency recovery from non-owner", async function () {
    //         await expect(
    //             tradeSettlement.connect(trader1).emergencyRecoverToken(
    //                 baseToken.address,
    //                 trader1.address,
    //                 TRADE_AMOUNT
    //             )
    //         ).to.be.revertedWith("Ownable: caller is not the owner");
    //     });
    // });

    describe("Nonce Management", function () {
        it("Should return correct user nonces", async function () {
            expect(await tradeSettlement.getUserNonce(trader1.address, baseToken.address)).to.equal(0);

            // After a trade, nonce should increment
            const tradeData = {
                orderId: 1,
                account: trader1.address,
                price: PRICE,
                quantity: TRADE_AMOUNT,
                side: "bid",
                baseAsset: baseToken.address,
                quoteAsset: quoteToken.address,
                tradeId: "trade123",
                timestamp: Math.floor(Date.now() / 1000),
                isValid: true
            };

            const messageHash1 = ethers.utils.solidityKeccak256(
                ["uint256", "address", "address", "uint256", "uint256", "string", "uint256", "uint256"],
                [1, baseToken.address, quoteToken.address, PRICE, TRADE_AMOUNT, "bid", tradeData.timestamp, 0]
            );

            const messageHash2 = ethers.utils.solidityKeccak256(
                ["uint256", "address", "address", "uint256", "uint256", "string", "uint256", "uint256"],
                [1, baseToken.address, quoteToken.address, PRICE, TRADE_AMOUNT, "ask", tradeData.timestamp, 0]
            );

            const signature1 = await trader1.signMessage(ethers.utils.arrayify(messageHash1));
            const signature2 = await trader2.signMessage(ethers.utils.arrayify(messageHash2));

            await tradeSettlement.settleTrade(
                tradeData,
                trader1.address,
                trader2.address,
                TRADE_AMOUNT,
                TRADE_AMOUNT,
                "bid",
                "ask",
                signature1,
                signature2,
                0,
                0
            );

            expect(await tradeSettlement.getUserNonce(trader1.address, baseToken.address)).to.equal(1);
            expect(await tradeSettlement.getUserNonce(trader2.address, baseToken.address)).to.equal(1);
        });
    });
});
