import { ethers } from 'ethers';
import { CRONOS_NETWORKS } from '@cronos-mcp/core';

export interface ActionResult {
  type: string;
  status: 'confirmed' | 'failed';
  txHash?: string;
  error?: string;
}

export class ActionExecutor {
  private wallet: ethers.Wallet;
  private network: 'testnet' | 'mainnet';
  
  constructor(privateKey: string, network: 'testnet' | 'mainnet' = 'testnet') {
    const networkConfig = network === 'mainnet'
      ? CRONOS_NETWORKS.MAINNET
      : CRONOS_NETWORKS.TESTNET;
    
    const provider = new ethers.JsonRpcProvider(networkConfig.rpcUrl);
    this.wallet = new ethers.Wallet(privateKey, provider);
    this.network = network;
  }
  
  async executeTransfer(to: string, amount: string): Promise<ActionResult> {
    try {
      const networkConfig = this.network === 'mainnet'
        ? CRONOS_NETWORKS.MAINNET
        : CRONOS_NETWORKS.TESTNET;
      
      const usdc = new ethers.Contract(
        networkConfig.usdcAddress,
        [
          'function transfer(address to, uint256 amount) returns (bool)',
          'function balanceOf(address) view returns (uint256)',
        ],
        this.wallet
      );
      
      const balance = await usdc.balanceOf(this.wallet.address);
      const amountWei = ethers.parseUnits(amount, 6);
      
      if (balance < amountWei) {
        return {
          type: 'transfer',
          status: 'failed',
          error: 'Insufficient balance',
        };
      }
      
      const tx = await usdc.transfer(to, amountWei);
      const receipt = await tx.wait();
      
      return {
        type: 'transfer',
        status: 'confirmed',
        txHash: receipt?.hash,
      };
    } catch (error) {
      return {
        type: 'transfer',
        status: 'failed',
        error: String(error),
      };
    }
  }
}