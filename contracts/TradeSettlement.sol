// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract TradeSettlement is ReentrancyGuard, Ownable {
    using ECDSA for bytes32;

    struct Trade {
        address party1;
        address party2;
        address baseAsset;
        address quoteAsset;
        uint256 price;
        uint256 quantity;
        string side1; // "bid" or "ask"
        string side2; // "bid" or "ask"
        uint256 timestamp;
        bytes signature1;
        bytes signature2;
    }

    struct TradeExecution {
        uint256 orderId;
        address account;
        uint256 price;
        uint256 quantity;
        string side;
        address baseAsset;
        address quoteAsset;
        string tradeId;
        uint256 timestamp;
        bool isValid;
    }

    mapping(address => mapping(address => uint256)) public nonces;
    mapping(bytes32 => bool) public executedTrades;

    event TradeSettled(
        address indexed party1,
        address indexed party2,
        address indexed baseAsset,
        address quoteAsset,
        uint256 price,
        uint256 quantity,
        uint256 timestamp
    );

    event AllowanceChecked(
        address indexed user,
        address indexed token,
        uint256 allowance,
        uint256 required,
        bool sufficient
    );

    constructor() {}

    /**
     * @dev Check if user has sufficient allowance for a token
     */
    function checkAllowance(
        address user,
        address token,
        uint256 requiredAmount
    ) public view returns (bool sufficient, uint256 currentAllowance) {
        IERC20 tokenContract = IERC20(token);
        currentAllowance = tokenContract.allowance(user, address(this));
        sufficient = currentAllowance >= requiredAmount;
        return (sufficient, currentAllowance);
    }

    /**
     * @dev Check if user has sufficient balance for a token
     */
    function checkBalance(
        address user,
        address token,
        uint256 requiredAmount
    ) public view returns (bool sufficient, uint256 currentBalance) {
        IERC20 tokenContract = IERC20(token);
        currentBalance = tokenContract.balanceOf(user);
        sufficient = currentBalance >= requiredAmount;
        return (sufficient, currentBalance);
    }

    /**
     * @dev Verify trade signature
     */
    function verifyTradeSignature(
        address signer,
        uint256 orderId,
        address baseAsset,
        address quoteAsset,
        uint256 price,
        uint256 quantity,
        string memory side,
        uint256 timestamp,
        uint256 nonce,
        bytes memory signature
    ) public pure returns (bool) {
        bytes32 messageHash = keccak256(
            abi.encodePacked(
                orderId,
                baseAsset,
                quoteAsset,
                price,
                quantity,
                side,
                timestamp,
                nonce
            )
        );

        bytes32 ethSignedMessageHash = messageHash.toEthSignedMessageHash();
        address recovered = ethSignedMessageHash.recover(signature);

        return recovered == signer;
    }

    /**
     * @dev Settle a trade between two parties
     */
    function settleTrade(
        TradeExecution memory tradeData,
        address party1,
        address party2,
        uint256 party1Quantity,
        uint256 party2Quantity,
        string memory party1Side,
        string memory party2Side,
        bytes memory signature1,
        bytes memory signature2,
        uint256 nonce1,
        uint256 nonce2
    ) external nonReentrant {
        require(tradeData.isValid, "Trade is not valid");

        // Create unique trade hash to prevent replay
        bytes32 tradeHash = keccak256(
            abi.encodePacked(
                party1,
                party2,
                tradeData.baseAsset,
                tradeData.quoteAsset,
                tradeData.price,
                tradeData.quantity,
                tradeData.timestamp
            )
        );

        require(!executedTrades[tradeHash], "Trade already executed");
        executedTrades[tradeHash] = true;

        // Verify signatures
        require(
            verifyTradeSignature(
                party1,
                tradeData.orderId,
                tradeData.baseAsset,
                tradeData.quoteAsset,
                tradeData.price,
                party1Quantity,
                party1Side,
                tradeData.timestamp,
                nonce1,
                signature1
            ),
            "Invalid party1 signature"
        );

        require(
            verifyTradeSignature(
                party2,
                tradeData.orderId,
                tradeData.baseAsset,
                tradeData.quoteAsset,
                tradeData.price,
                party2Quantity,
                party2Side,
                tradeData.timestamp,
                nonce2,
                signature2
            ),
            "Invalid party2 signature"
        );

        // Update nonces
        nonces[party1][tradeData.baseAsset] = nonce1 + 1;
        nonces[party2][tradeData.baseAsset] = nonce2 + 1;

        // Calculate amounts
        uint256 baseAmount = tradeData.quantity;
        uint256 quoteAmount = (tradeData.quantity * tradeData.price) / 1e18; // Assuming 18 decimal price

        // Determine who pays what based on sides
        address basePayer;
        address baseReceiver;
        address quotePayer;
        address quoteReceiver;

        if (
            keccak256(abi.encodePacked(party1Side)) ==
            keccak256(abi.encodePacked("bid"))
        ) {
            // Party1 is bidder (buys base, pays quote)
            quotePayer = party1;
            quoteReceiver = party2;
            basePayer = party2;
            baseReceiver = party1;
        } else {
            // Party1 is asker (sells base, receives quote)
            basePayer = party1;
            baseReceiver = party2;
            quotePayer = party2;
            quoteReceiver = party1;
        }

        // Check allowances and balances
        (bool baseAllowanceSufficient, uint256 baseAllowance) = checkAllowance(
            basePayer,
            tradeData.baseAsset,
            baseAmount
        );
        require(baseAllowanceSufficient, "Insufficient base asset allowance");

        (
            bool quoteAllowanceSufficient,
            uint256 quoteAllowance
        ) = checkAllowance(quotePayer, tradeData.quoteAsset, quoteAmount);
        require(quoteAllowanceSufficient, "Insufficient quote asset allowance");

        (bool baseBalanceSufficient, ) = checkBalance(
            basePayer,
            tradeData.baseAsset,
            baseAmount
        );
        require(baseBalanceSufficient, "Insufficient base asset balance");

        (bool quoteBalanceSufficient, ) = checkBalance(
            quotePayer,
            tradeData.quoteAsset,
            quoteAmount
        );
        require(quoteBalanceSufficient, "Insufficient quote asset balance");

        // Execute transfers
        IERC20 baseToken = IERC20(tradeData.baseAsset);
        IERC20 quoteToken = IERC20(tradeData.quoteAsset);

        require(
            baseToken.transferFrom(basePayer, baseReceiver, baseAmount),
            "Base asset transfer failed"
        );

        require(
            quoteToken.transferFrom(quotePayer, quoteReceiver, quoteAmount),
            "Quote asset transfer failed"
        );

        emit TradeSettled(
            party1,
            party2,
            tradeData.baseAsset,
            tradeData.quoteAsset,
            tradeData.price,
            tradeData.quantity,
            block.timestamp
        );
    }

    /**
     * @dev Batch check allowances for multiple users and tokens
     */
    function batchCheckAllowances(
        address[] memory users,
        address[] memory tokens,
        uint256[] memory amounts
    )
        external
        view
        returns (bool[] memory sufficient, uint256[] memory allowances)
    {
        require(
            users.length == tokens.length && tokens.length == amounts.length,
            "Array lengths mismatch"
        );

        sufficient = new bool[](users.length);
        allowances = new uint256[](users.length);

        for (uint256 i = 0; i < users.length; i++) {
            (sufficient[i], allowances[i]) = checkAllowance(
                users[i],
                tokens[i],
                amounts[i]
            );
        }

        return (sufficient, allowances);
    }

    /**
     * @dev Get user nonce for a specific token
     */
    function getUserNonce(
        address user,
        address token
    ) external view returns (uint256) {
        return nonces[user][token];
    }

    /**
     * @dev Emergency function to recover stuck tokens (only owner)
     */
    function emergencyRecoverToken(
        address token,
        address to,
        uint256 amount
    ) external onlyOwner {
        IERC20(token).transfer(to, amount);
    }
}
