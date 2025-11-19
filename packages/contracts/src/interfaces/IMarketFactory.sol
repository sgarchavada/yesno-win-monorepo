// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

/**
 * @title IMarketFactory
 * @notice Interface for MarketFactory contract
 */
interface IMarketFactory {
    function oracleAdapter() external view returns (address);
}

