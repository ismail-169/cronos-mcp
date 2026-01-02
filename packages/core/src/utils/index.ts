// =============================================================================
// @cronos-mcp/core - Utilities
// =============================================================================

import { CRONOS_NETWORKS } from '../constants/index.js';

// USDC has 6 decimals
const USDC_DECIMALS = 6;

/**
 * Generate a random 32-byte nonce as hex string
 */
export function generateNonce(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return '0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Calculate validBefore timestamp
 */
export function calculateValidBefore(timeoutSeconds: number): number {
  return Math.floor(Date.now() / 1000) + timeoutSeconds;
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxRetries - 1) {
        await sleep(baseDelay * Math.pow(2, attempt));
      }
    }
  }
  
  throw lastError;
}

/**
 * Validate Ethereum address format
 */
export function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Validate transaction hash format
 */
export function isValidTxHash(hash: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/.test(hash);
}

/**
 * Shorten address for display
 */
export function shortenAddress(address: string, chars: number = 4): string {
  if (!isValidAddress(address)) return address;
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

/**
 * Parse payment header from base64
 */
export function parsePaymentHeader(base64Header: string): unknown {
  try {
    const json = Buffer.from(base64Header, 'base64').toString('utf-8');
    return JSON.parse(json);
  } catch {
    throw new Error('Invalid payment header format');
  }
}

/**
 * Encode payment header to base64
 */
export function encodePaymentHeader(payload: unknown): string {
  const json = JSON.stringify(payload);
  return Buffer.from(json).toString('base64');
}

/**
 * Create explorer URL for transaction
 */
export function getExplorerTxUrl(txHash: string, network: 'testnet' | 'mainnet'): string {
  const config = network === 'mainnet' ? CRONOS_NETWORKS.MAINNET : CRONOS_NETWORKS.TESTNET;
  return `${config.explorerUrl}/tx/${txHash}`;
}

/**
 * Create explorer URL for address
 */
export function getExplorerAddressUrl(address: string, network: 'testnet' | 'mainnet'): string {
  const config = network === 'mainnet' ? CRONOS_NETWORKS.MAINNET : CRONOS_NETWORKS.TESTNET;
  return `${config.explorerUrl}/address/${address}`;
}