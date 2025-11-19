// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";

contract SyncMarketReservesScript is Script {
    function run() external {
        // Market address to sync
        address marketAddress = 0x9CD84cA84cd441f636fCE1C976221B492e6a3E44;
        
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        vm.startBroadcast(deployerPrivateKey);

        console.log("\n=== Syncing Market Reserves ===");
        console.log("  Market: %s", marketAddress);
        console.log("  Caller: %s", deployer);

        // Call syncReserves() on the market
        (bool success, bytes memory data) = marketAddress.call(
            abi.encodeWithSignature("syncReserves()")
        );

        if (success) {
            console.log("\n  SUCCESS: Reserves synced!");
        } else {
            console.log("\n  FAILED: Could not sync reserves");
            console.log("  Error data:");
            console.logBytes(data);
        }

        vm.stopBroadcast();
    }
}

