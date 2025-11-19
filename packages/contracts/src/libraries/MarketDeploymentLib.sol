// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {Market} from "../Market.sol";
import {OutcomeToken} from "../OutcomeToken.sol";
import {LPToken} from "../LPToken.sol";

/**
 * @title MarketDeploymentLib
 * @notice Library for deploying markets and associated contracts
 * @dev Externalizes deployment logic to reduce MarketFactory size
 */
library MarketDeploymentLib {
    using SafeERC20 for IERC20;

    struct DeploymentParams {
        address factory;
        address creator;
        address collateralToken;
        address marketImplementation;
        address outcomeTokenImplementation;
        address lpTokenImplementation;
        string question;
        string[] outcomes;
        uint256 endTime;
        uint256 lpFeeBps;
        uint256 protocolFeeBps;
        uint256 parlayFeeBps;
        uint256 initialLiquidity;
    }

    /**
     * @notice Deploy a complete market with all components
     */
    function deployMarket(DeploymentParams memory params)
        external
        returns (address market, address lpToken, address[] memory outcomeTokens)
    {
        // Deploy LPToken
        lpToken = _deployLPToken(params.lpTokenImplementation);

        // Deploy outcome tokens
        outcomeTokens = new address[](params.outcomes.length);
        for (uint256 i = 0; i < params.outcomes.length; i++) {
            outcomeTokens[i] = _deployOutcomeToken(params.outcomeTokenImplementation);
        }

        // Deploy market
        market = _deployMarket(
            params.factory,
            params.creator,
            params.collateralToken,
            lpToken,
            params.marketImplementation,
            params.question,
            params.outcomes,
            outcomeTokens,
            params.endTime,
            params.lpFeeBps,
            params.protocolFeeBps,
            params.parlayFeeBps,
            params.initialLiquidity
        );

        // Initialize LP token
        LPToken(lpToken).initialize(
            market,
            string(abi.encodePacked("LP-", params.question)),
            "YNLP"
        );

        // Initialize outcome tokens
        for (uint256 i = 0; i < outcomeTokens.length; i++) {
            OutcomeToken(outcomeTokens[i]).initialize(
                market,
                i,
                params.outcomes[i],
                string(abi.encodePacked("Outcome ", _toString(i), ": ", params.outcomes[i]))
            );
        }

        // Transfer initial liquidity to market
        IERC20(params.collateralToken).safeTransfer(market, params.initialLiquidity);

        // Complete LP initialization
        Market(market).completeLPInitialization(params.creator, params.initialLiquidity);

        return (market, lpToken, outcomeTokens);
    }

    /**
     * @dev Deploy Market proxy
     */
    function _deployMarket(
        address factory,
        address creator,
        address collateralToken,
        address lpToken,
        address marketImplementation,
        string memory question,
        string[] memory outcomes,
        address[] memory outcomeTokens,
        uint256 endTime,
        uint256 lpFeeBps,
        uint256 protocolFeeBps,
        uint256 parlayFeeBps,
        uint256 initialLiquidity
    ) private returns (address) {
        bytes memory initData = abi.encodeWithSelector(
            Market.initialize.selector,
            factory,
            creator,
            collateralToken,
            lpToken,
            question,
            outcomes,
            outcomeTokens,
            endTime,
            lpFeeBps,
            protocolFeeBps,
            parlayFeeBps,
            initialLiquidity
        );

        ERC1967Proxy proxy = new ERC1967Proxy(marketImplementation, initData);
        return address(proxy);
    }

    /**
     * @dev Deploy LPToken proxy
     */
    function _deployLPToken(address lpTokenImplementation) private returns (address) {
        ERC1967Proxy proxy = new ERC1967Proxy(lpTokenImplementation, "");
        return address(proxy);
    }

    /**
     * @dev Deploy OutcomeToken proxy
     */
    function _deployOutcomeToken(address outcomeTokenImplementation) private returns (address) {
        ERC1967Proxy proxy = new ERC1967Proxy(outcomeTokenImplementation, "");
        return address(proxy);
    }

    /**
     * @dev Convert uint to string
     */
    function _toString(uint256 value) private pure returns (string memory) {
        if (value == 0) return "0";
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

