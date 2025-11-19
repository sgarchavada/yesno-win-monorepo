// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {ERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

/**
 * @title OutcomeToken
 * @notice ERC20 token representing shares in a specific market outcome (Polymarket-style)
 * @dev Conditional token that can ONLY be minted/burned by the parent Market contract
 * 
 * Each outcome token represents a claim on 1 unit of collateral (e.g., 1 USDC) if that outcome wins.
 * Losing outcome tokens become worthless after market resolution.
 * 
 * Upgradeable: No - This is a simple ERC20 deployed per outcome, not upgradeable itself
 * The Market contract that controls it is upgradeable.
 */
contract OutcomeToken is Initializable, ERC20Upgradeable {
    // ─────────────────────────────────────────────────────────────────────────────
    // Storage
    // ─────────────────────────────────────────────────────────────────────────────

    /// @notice The Market contract that can mint/burn these tokens
    address public market;
    
    /// @notice Index of this outcome in the parent market (0-indexed)
    uint256 public outcomeIndex;
    
    /// @notice Human-readable description of this outcome
    string public outcomeDescription;

    // ─────────────────────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────────────────────

    event TokensMinted(address indexed to, uint256 amount);
    event TokensBurned(address indexed from, uint256 amount);

    // ─────────────────────────────────────────────────────────────────────────────
    // Errors
    // ─────────────────────────────────────────────────────────────────────────────

    error OnlyMarket();
    error InvalidAddress();
    error InvalidAmount();
    error InsufficientBalance();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Initializer
    // ─────────────────────────────────────────────────────────────────────────────

    /**
     * @notice Initialize the outcome token
     * @param _market Address of the Market contract that controls this token
     * @param _outcomeIndex Index of this outcome in the market
     * @param _outcomeName Short name for the token (e.g., "YES", "NO", "Trump")
     * @param _outcomeDescription Full description of the outcome
     */
    function initialize(
        address _market,
        uint256 _outcomeIndex,
        string memory _outcomeName,
        string memory _outcomeDescription
    ) external initializer {
        if (_market == address(0)) revert InvalidAddress();

        // Initialize ERC20 with name and symbol
        // Symbol format: "OUT{index}" (e.g., "OUT0", "OUT1")
        __ERC20_init(
            _outcomeName,
            string(abi.encodePacked("OUT", _uint256ToString(_outcomeIndex)))
        );

        market = _market;
        outcomeIndex = _outcomeIndex;
        outcomeDescription = _outcomeDescription;
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Minting & Burning (Only Market)
    // ─────────────────────────────────────────────────────────────────────────────

    /**
     * @notice Mint outcome tokens to an address
     * @dev Only callable by the Market contract when users buy shares
     * @param _to Recipient address
     * @param _amount Amount of tokens to mint
     */
    function mint(address _to, uint256 _amount) external {
        if (msg.sender != market) revert OnlyMarket();
        if (_to == address(0)) revert InvalidAddress();
        if (_amount == 0) revert InvalidAmount();

        _mint(_to, _amount);
        emit TokensMinted(_to, _amount);
    }

    /**
     * @notice Burn outcome tokens from an address
     * @dev Only callable by the Market contract when users sell shares or claim winnings
     * @param _from Address to burn tokens from
     * @param _amount Amount of tokens to burn
     */
    function burn(address _from, uint256 _amount) external {
        if (msg.sender != market) revert OnlyMarket();
        if (_from == address(0)) revert InvalidAddress();
        if (_amount == 0) revert InvalidAmount();
        if (balanceOf(_from) < _amount) revert InsufficientBalance();

        _burn(_from, _amount);
        emit TokensBurned(_from, _amount);
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Views
    // ─────────────────────────────────────────────────────────────────────────────

    /**
     * @notice Get the Market contract address
     * @return Address of the controlling Market contract
     */
    function getMarket() external view returns (address) {
        return market;
    }

    /**
     * @notice Get the outcome index
     * @return Index of this outcome in the parent market
     */
    function getOutcomeIndex() external view returns (uint256) {
        return outcomeIndex;
    }

    /**
     * @notice Get the outcome description
     * @return Human-readable description of this outcome
     */
    function getDescription() external view returns (string memory) {
        return outcomeDescription;
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Internal Helpers
    // ─────────────────────────────────────────────────────────────────────────────

    /**
     * @dev Convert uint256 to string for symbol generation
     */
    function _uint256ToString(uint256 value) internal pure returns (string memory) {
        if (value == 0) {
            return "0";
        }
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
}

