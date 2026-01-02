// =============================================================================
// @cronos-mcp/payment - EIP-712 Payment Signing
// =============================================================================
// CORRECTED per Official Cronos x402 Documentation
// Source: https://docs.cronos.org/cronos-x402-facilitator/quick-start-for-buyers
//
// CRITICAL FIXES:
// 1. EIP712_DOMAIN.NAME = "Bridged USDC (Stargate)" (NOT "USD Coin")
// 2. EIP712_DOMAIN.VERSION = "1" (NOT "2")
// 3. Payload structure is FLAT (not nested with 'authorization')
// 4. Asset field is REQUIRED in payload
// =============================================================================

import { ethers } from 'ethers';
import {
  EIP712_DOMAIN,
  CRONOS_NETWORKS,
  X402_VERSION,
  PAYMENT_SCHEMES,
  TIMEOUTS,
} from '@cronos-mcp/core';
import type { PaymentRequirements } from '@cronos-mcp/core';

// =============================================================================
// CORRECTED Payment Payload Type (matches official Cronos x402 format)
// =============================================================================
// NOTE: This replaces the incorrect PaymentPayload type from @cronos-mcp/core
// The official structure is FLAT, not nested with 'authorization'

export interface CronosPaymentPayload {
  x402Version: number;
  scheme: string;
  network: string;
  payload: {
    from: string;
    to: string;
    value: string;
    validAfter: number;
    validBefore: number;
    nonce: string;
    signature: string;
    asset: string;  // ✅ REQUIRED
  };
}

/**
 * EIP-712 Types for TransferWithAuthorization (EIP-3009)
 */
const TransferWithAuthorizationTypes = {
  TransferWithAuthorization: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'validAfter', type: 'uint256' },
    { name: 'validBefore', type: 'uint256' },
    { name: 'nonce', type: 'bytes32' },
  ],
};

/**
 * Generate a random 32-byte nonce for EIP-3009 authorization
 */
export function generateNonce(): string {
  return ethers.hexlify(ethers.randomBytes(32));
}

/**
 * Create a signed payment authorization using OFFICIAL Cronos x402 parameters
 *
 * CRITICAL: Domain parameters:
 * - name: "Bridged USDC (Stargate)" (NOT "USD Coin" or "Bridged USDC")
 * - version: "1" (NOT "2")
 *
 * CRITICAL: Payload structure is FLAT (not nested with 'authorization')
 *
 * @param wallet - Ethers wallet for signing
 * @param requirements - Payment requirements from 402 response
 * @param network - Network to use ('testnet' | 'mainnet')
 * @returns Base64 encoded payment header
 */
export async function createPaymentHeader(
  wallet: ethers.Wallet,
  requirements: PaymentRequirements,
  network: 'testnet' | 'mainnet' = 'testnet'
): Promise<string> {
  const networkConfig = network === 'mainnet'
    ? CRONOS_NETWORKS.MAINNET
    : CRONOS_NETWORKS.TESTNET;

  // Generate random nonce (32 bytes)
  const nonce = generateNonce();

  // Calculate validity window
  const validAfter = 0;
  const validBefore = Math.floor(Date.now() / 1000) + TIMEOUTS.PAYMENT_VALIDITY;

  // ==========================================================================
  // EIP-712 Domain - OFFICIAL CRONOS X402 PARAMETERS
  // ==========================================================================
  // Source: https://docs.cronos.org/cronos-x402-facilitator/quick-start-for-buyers
  //
  // Common Pitfall from official docs:
  // WRONG:   { name: 'Bridged USDC', version: '2' }
  // CORRECT: { name: 'Bridged USDC (Stargate)', version: '1' }

  const domain = {
    name: EIP712_DOMAIN.NAME,       // "Bridged USDC (Stargate)"
    version: EIP712_DOMAIN.VERSION, // "1"
    chainId: networkConfig.chainId,
    verifyingContract: requirements.asset,
  };

  // Message to sign
  const message = {
    from: wallet.address,
    to: requirements.payTo,
    value: BigInt(requirements.maxAmountRequired),
    validAfter: validAfter,
    validBefore: validBefore,
    nonce: nonce,
  };

  // Sign with EIP-712
  const signature = await wallet.signTypedData(
    domain,
    TransferWithAuthorizationTypes,
    message
  );

  // ==========================================================================
  // CREATE PAYMENT PAYLOAD - OFFICIAL CRONOS X402 STRUCTURE
  // ==========================================================================
  // CRITICAL FIX: Structure is FLAT (not nested with 'authorization')
  // CRITICAL FIX: 'asset' field MUST be included
  //
  // Official structure from docs:
  // {
  //   "x402Version": 1,
  //   "scheme": "exact",
  //   "network": "cronos-testnet",
  //   "payload": {
  //     "from": "0xFrom...",
  //     "to": "0xPayTo...",
  //     "value": "1000000",
  //     "validAfter": 0,
  //     "validBefore": 1735689551,
  //     "nonce": "0xNonce...",
  //     "signature": "0xSignature...",
  //     "asset": "0xUSDCE..."
  //   }
  // }

  const paymentPayload: CronosPaymentPayload = {
    x402Version: X402_VERSION,
    scheme: requirements.scheme || PAYMENT_SCHEMES.EXACT,
    network: requirements.network,
    payload: {
      from: wallet.address,
      to: requirements.payTo,
      value: requirements.maxAmountRequired,
      validAfter: validAfter,
      validBefore: validBefore,
      nonce: nonce,
      signature: signature,
      asset: requirements.asset,  // ✅ REQUIRED by Cronos Facilitator
    },
  };

  // Base64 encode
  return Buffer.from(JSON.stringify(paymentPayload)).toString('base64');
}

/**
 * Decode a base64 payment header
 */
export function decodePaymentHeader(base64Header: string): CronosPaymentPayload {
  const json = Buffer.from(base64Header, 'base64').toString('utf-8');
  return JSON.parse(json) as CronosPaymentPayload;
}

/**
 * Validate payment payload structure (CORRECTED for official format)
 */
export function validatePaymentPayload(payload: CronosPaymentPayload): boolean {
  if (!payload.x402Version || payload.x402Version !== X402_VERSION) {
    return false;
  }
  if (!payload.scheme || !payload.network) {
    return false;
  }
  // Check FLAT structure (not nested authorization)
  if (!payload.payload?.signature || !payload.payload?.nonce || !payload.payload?.asset) {
    return false;
  }
  return true;
}