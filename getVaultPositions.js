const { ethers } = require('ethers');
const vaultABI = require('./vaultABI.json');
require('dotenv').config();

async function getVaultPositions(blockNumber, vaultAddress, rpcUrl) {
    // Connect to the network
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    
    // Get contract code to verify it exists
    const code = await provider.getCode(vaultAddress);
    console.log('Contract code exists:', code !== '0x');
    console.log('Contract code length:', code.length);

    // Initialize vault contract
    const vault = new ethers.Contract(vaultAddress, vaultABI, provider);

    // Try to get basic information about the vault
    try {
        const name = await vault.name();
        console.log('Vault name:', name);
    } catch (e) {
        console.log('Failed to get name:', e.message);
    }

    try {
        const symbol = await vault.symbol();
        console.log('Vault symbol:', symbol);
    } catch (e) {
        console.log('Failed to get symbol:', e.message);
    }

    try {
        const totalSupply = await vault.totalSupply();
        console.log('Total supply:', totalSupply.toString());
    } catch (e) {
        console.log('Failed to get total supply:', e.message);
    }

    // Try to get initialization status
    try {
        const isInitialized = await vault.isShutdown();
        console.log('Is shutdown:', isInitialized);
    } catch (e) {
        console.log('Failed to check initialization status');
    }

    // Get all Transfer events from genesis to specified block to find all holders
    try {
        const filter = vault.filters.Transfer();
        const latestBlock = await provider.getBlockNumber();
        console.log('Latest block:', latestBlock);
        
        // Get events in chunks to avoid RPC timeout
        const CHUNK_SIZE = 10000;
        let allEvents = [];
        let startBlock = 0;
        
        while (startBlock <= latestBlock) {
            const endBlock = Math.min(startBlock + CHUNK_SIZE, latestBlock);
            console.log(`Querying blocks ${startBlock} to ${endBlock}...`);
            
            const events = await vault.queryFilter(filter, startBlock, endBlock);
            allEvents = allEvents.concat(events);
            startBlock = endBlock + 1;
        }

        console.log('Found', allEvents.length, 'transfer events');

        // Create a Set of unique addresses that have interacted with the vault
        const addresses = new Set();
        allEvents.forEach(event => {
            if (event.args) {
                addresses.add(event.args.sender);
                addresses.add(event.args.receiver);
            }
        });
        // Remove zero address and null address
        addresses.delete('0x0000000000000000000000000000000000000000');
        addresses.delete(null);

        console.log('Found', addresses.size, 'unique addresses');

        // Get pricePerShare at the specified block
        const pricePerShare = await vault.pricePerShare({ blockTag: blockNumber });
        console.log('Price per share:', pricePerShare.toString());

        // Get balances
        const balancePromises = Array.from(addresses).map(async address => {
            try {
                const balance = await vault.balanceOf(address, { blockTag: blockNumber });
                // Calculate underlying token amount
                const underlyingBalance = balance.mul(pricePerShare).div(ethers.BigNumber.from(10).pow(18));
                return { address, balance: underlyingBalance };
            } catch (e) {
                console.log('Failed to get balance for', address, ':', e.message);
                return { address, balance: ethers.BigNumber.from(0) };
            }
        });

        const balances = await Promise.all(balancePromises);

        // Filter and format non-zero balances
        const nonZeroBalances = balances
            .filter(b => !b.balance.isZero())
            .map(b => ({
                id: b.address.toLowerCase(),
                balance: b.balance.toString()
            }));

        console.log('Addresses with non-zero balances:', nonZeroBalances.length);
        
        // Save to output.json
        const fs = require('fs');
        fs.writeFileSync(
            'output.json', 
            JSON.stringify(nonZeroBalances, null, 2)
        );
        console.log('Results saved to output.json');

        return nonZeroBalances;

    } catch (error) {
        console.error('Error processing events:', error);
        throw error;
    }
}

// Example usage
async function main() {
    const BLOCK_NUMBER = process.env.BLOCK_NUMBER || 'latest';
    const VAULT_ADDRESS = process.env.VAULT_ADDRESS;
    const RPC_URL = process.env.RPC_URL;

    if (!VAULT_ADDRESS) {
        throw new Error('VAULT_ADDRESS not set in .env file');
    }

    if (!RPC_URL) {
        throw new Error('RPC_URL not set in .env file');
    }

    try {
        console.log('Checking vault at address:', VAULT_ADDRESS);
        console.log('Block number:', BLOCK_NUMBER);
        console.log('Using RPC URL:', RPC_URL);
        
        const positions = await getVaultPositions(BLOCK_NUMBER, VAULT_ADDRESS, RPC_URL);

    } catch (error) {
        console.error('Main Error:', error);
    }
}

if (require.main === module) {
    main();
}

module.exports = getVaultPositions; 