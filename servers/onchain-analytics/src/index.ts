// =============================================================================
// Onchain Analytics MCP Server
// x402-powered Cronos blockchain analytics
// =============================================================================

import 'dotenv/config';
import { createServer } from '@cronos-mcp/server-sdk';
import { usdToBaseUnits, CRONOS_NETWORKS } from '@cronos-mcp/core';
import { ethers } from 'ethers';

const NETWORK = process.env.NETWORK === 'mainnet' ? 'mainnet' : 'testnet';
const networkConfig = NETWORK === 'mainnet' ? CRONOS_NETWORKS.MAINNET : CRONOS_NETWORKS.TESTNET;
const provider = new ethers.JsonRpcProvider(networkConfig.rpcUrl);

// Cronos Explorer API
const EXPLORER_API = NETWORK === 'mainnet'
  ? 'https://api.cronoscan.com/api'
  : 'https://api-testnet.cronoscan.com/api';

// Create server
const server = createServer({
  projectName: 'CronosMCP',
  name: 'onchain-analytics-server',
  version: '1.0.0',
  description: 'Cronos blockchain analytics with x402 payments',
  paymentAddress: process.env.PAYMENT_ADDRESS ?? '0x0000000000000000000000000000000000000000',
  facilitatorUrl: process.env.FACILITATOR_URL ?? 'https://facilitator.cronoslabs.org/v2/x402',
  network: NETWORK as 'testnet' | 'mainnet',
  port: parseInt(process.env.PORT ?? '3002'),
});

// Free tool: Get wallet balance
server.addTool({
  name: 'get_balance',
  description: 'Get CRO balance for an address (free)',
  price: '0',
  inputSchema: {
    type: 'object',
    properties: {
      address: {
        type: 'string',
        description: 'Wallet address (0x...)',
      },
    },
    required: ['address'],
  },
  handler: async (params) => {
    const address = params.address as string;
    
    try {
      const balance = await provider.getBalance(address);
      return {
        address,
        balance: ethers.formatEther(balance),
        balanceWei: balance.toString(),
        network: NETWORK,
      };
    } catch (error) {
      return { error: 'Failed to fetch balance', address };
    }
  },
});

// Paid tool: Get transaction history
server.addTool({
  name: 'get_transactions',
  description: 'Get transaction history for an address',
  price: usdToBaseUnits(0.001), // $0.001
  inputSchema: {
    type: 'object',
    properties: {
      address: {
        type: 'string',
        description: 'Wallet address',
      },
      limit: {
        type: 'number',
        description: 'Number of transactions (max 100)',
        default: 20,
      },
    },
    required: ['address'],
  },
  handler: async (params) => {
    const address = params.address as string;
    const limit = Math.min(params.limit as number || 20, 100);
    
    try {
      const apiKey = process.env.EXPLORER_API_KEY || '';
      const url = `${EXPLORER_API}?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=${limit}&sort=desc&apikey=${apiKey}`;
      
      const response = await fetch(url);
      const data = await response.json() as {
        status: string;
        result?: Array<{
          hash: string;
          blockNumber: string;
          timeStamp: string;
          from: string;
          to: string;
          value: string;
          gas: string;
          gasUsed: string;
          isError: string;
        }>;
      };
      
      if (data.status === '1' && data.result) {
        return {
          address,
          transactions: data.result.map(tx => ({
            hash: tx.hash,
            blockNumber: parseInt(tx.blockNumber),
            timestamp: parseInt(tx.timeStamp),
            from: tx.from,
            to: tx.to,
            value: ethers.formatEther(tx.value),
            gasUsed: tx.gasUsed,
            isError: tx.isError === '1',
          })),
          network: NETWORK,
        };
      }
      
      return { address, transactions: [], network: NETWORK };
    } catch (error) {
      return { error: 'Failed to fetch transactions', address };
    }
  },
});

// Paid tool: Get token transfers
server.addTool({
  name: 'get_token_transfers',
  description: 'Get ERC20 token transfers for an address',
  price: usdToBaseUnits(0.002), // $0.002
  inputSchema: {
    type: 'object',
    properties: {
      address: {
        type: 'string',
        description: 'Wallet address',
      },
      token: {
        type: 'string',
        description: 'Token contract address (optional)',
      },
      limit: {
        type: 'number',
        description: 'Number of transfers (max 100)',
        default: 20,
      },
    },
    required: ['address'],
  },
  handler: async (params) => {
    const address = params.address as string;
    const token = params.token as string | undefined;
    const limit = Math.min(params.limit as number || 20, 100);
    
    try {
      const apiKey = process.env.EXPLORER_API_KEY || '';
      let url = `${EXPLORER_API}?module=account&action=tokentx&address=${address}&page=1&offset=${limit}&sort=desc&apikey=${apiKey}`;
      
      if (token) {
        url += `&contractaddress=${token}`;
      }
      
      const response = await fetch(url);
      const data = await response.json() as {
        status: string;
        result?: Array<{
          hash: string;
          blockNumber: string;
          timeStamp: string;
          from: string;
          to: string;
          value: string;
          tokenName: string;
          tokenSymbol: string;
          tokenDecimal: string;
          contractAddress: string;
        }>;
      };
      
      if (data.status === '1' && data.result) {
        return {
          address,
          transfers: data.result.map(tx => ({
            hash: tx.hash,
            blockNumber: parseInt(tx.blockNumber),
            timestamp: parseInt(tx.timeStamp),
            from: tx.from,
            to: tx.to,
            value: tx.value,
            tokenName: tx.tokenName,
            tokenSymbol: tx.tokenSymbol,
            tokenDecimals: parseInt(tx.tokenDecimal),
            tokenAddress: tx.contractAddress,
          })),
          network: NETWORK,
        };
      }
      
      return { address, transfers: [], network: NETWORK };
    } catch (error) {
      return { error: 'Failed to fetch token transfers', address };
    }
  },
});

// Paid tool: Get contract info
server.addTool({
  name: 'get_contract_info',
  description: 'Get contract metadata and verification status',
  price: usdToBaseUnits(0.001), // $0.001
  inputSchema: {
    type: 'object',
    properties: {
      address: {
        type: 'string',
        description: 'Contract address',
      },
    },
    required: ['address'],
  },
  handler: async (params) => {
    const address = params.address as string;
    
    try {
      // Get bytecode
      const code = await provider.getCode(address);
      const isContract = code !== '0x';
      
      if (!isContract) {
        return {
          address,
          isContract: false,
          network: NETWORK,
        };
      }
      
      // Get contract info from explorer
      const apiKey = process.env.EXPLORER_API_KEY || '';
      const url = `${EXPLORER_API}?module=contract&action=getsourcecode&address=${address}&apikey=${apiKey}`;
      
      const response = await fetch(url);
      const data = await response.json() as {
        status: string;
        result?: Array<{
          ContractName: string;
          CompilerVersion: string;
          OptimizationUsed: string;
          SourceCode: string;
          ABI: string;
        }>;
      };
      
      if (data.status === '1' && data.result?.[0]) {
        const info = data.result[0];
        return {
          address,
          isContract: true,
          isVerified: !!info.SourceCode,
          contractName: info.ContractName || null,
          compilerVersion: info.CompilerVersion || null,
          optimizationUsed: info.OptimizationUsed === '1',
          network: NETWORK,
        };
      }
      
      return {
        address,
        isContract: true,
        isVerified: false,
        network: NETWORK,
      };
    } catch (error) {
      return { error: 'Failed to fetch contract info', address };
    }
  },
});

// Paid tool: Deep wallet analysis
server.addTool({
  name: 'analyze_wallet',
  description: 'Comprehensive wallet analysis including activity summary',
  price: usdToBaseUnits(0.005), // $0.005
  inputSchema: {
    type: 'object',
    properties: {
      address: {
        type: 'string',
        description: 'Wallet address',
      },
    },
    required: ['address'],
  },
  handler: async (params) => {
    const address = params.address as string;
    
    try {
      // Get balance
      const balance = await provider.getBalance(address);
      
      // Get transaction count
      const txCount = await provider.getTransactionCount(address);
      
      // Get recent transactions
      const apiKey = process.env.EXPLORER_API_KEY || '';
      const txUrl = `${EXPLORER_API}?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=100&sort=desc&apikey=${apiKey}`;
      
      const txResponse = await fetch(txUrl);
      const txData = await txResponse.json() as {
        status: string;
        result?: Array<{
          timeStamp: string;
          from: string;
          to: string;
          value: string;
          isError: string;
        }>;
      };
      
      // Analyze transactions
      let totalSent = BigInt(0);
      let totalReceived = BigInt(0);
      let successfulTxs = 0;
      let failedTxs = 0;
      let firstTxTime: number | null = null;
      let lastTxTime: number | null = null;
      const uniqueInteractions = new Set<string>();
      
      if (txData.status === '1' && txData.result) {
        for (const tx of txData.result) {
          const timestamp = parseInt(tx.timeStamp);
          if (!firstTxTime || timestamp < firstTxTime) firstTxTime = timestamp;
          if (!lastTxTime || timestamp > lastTxTime) lastTxTime = timestamp;
          
          if (tx.isError === '0') {
            successfulTxs++;
          } else {
            failedTxs++;
          }
          
          const value = BigInt(tx.value);
          if (tx.from.toLowerCase() === address.toLowerCase()) {
            totalSent += value;
            if (tx.to) uniqueInteractions.add(tx.to.toLowerCase());
          } else {
            totalReceived += value;
            uniqueInteractions.add(tx.from.toLowerCase());
          }
        }
      }
      
      return {
        address,
        balance: ethers.formatEther(balance),
        transactionCount: txCount,
        activity: {
          totalSent: ethers.formatEther(totalSent),
          totalReceived: ethers.formatEther(totalReceived),
          successfulTransactions: successfulTxs,
          failedTransactions: failedTxs,
          uniqueAddressesInteracted: uniqueInteractions.size,
          firstTransaction: firstTxTime,
          lastTransaction: lastTxTime,
        },
        network: NETWORK,
      };
    } catch (error) {
      return { error: 'Failed to analyze wallet', address };
    }
  },
});

// Start server
server.start().catch(console.error);