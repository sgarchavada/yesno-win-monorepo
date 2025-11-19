// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockUSDC
 * @notice 6-decimal token to match real USDC standard
 */
contract MockUSDC is ERC20, Ownable {
    constructor() ERC20("USDC Token", "USDC") Ownable(msg.sender) {
        // Mint 1,000,000 USDC (with 6 decimals) to deployer
        _mint(msg.sender, 1_000_000 * 10**6);
    }
    
    function decimals() public pure override returns (uint8) {
        return 6;
    }
    
    /**
     * @notice Mint additional tokens (only owner can mint)
     * @param to Address to mint to
     * @param amount Amount in USDC (with 6 decimals)
     */
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}

contract DeployMockUSDC is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);
        
        MockUSDC usdc = new MockUSDC();
        
        console.log("MockUSDC deployed at:", address(usdc));
        console.log("Decimals:", usdc.decimals());
        console.log("Total Supply:", usdc.totalSupply());
        console.log("Balance of deployer:", usdc.balanceOf(msg.sender));
        
        vm.stopBroadcast();
    }
}

