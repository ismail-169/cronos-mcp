// =============================================================================
// @cronos-mcp/core - Constants
// =============================================================================
// CORRECTED per Official Cronos x402 Documentation
// Source: https://docs.cronos.org/cronos-x402-facilitator/quick-start-for-buyers
//
// CRITICAL CHANGES:
// 1. EIP-712 name: "Bridged USDC (Stargate)" (was "USD Coin") 
// 2. EIP-712 version: "1" (was "2")
// 3. Added mainnet configuration
// =============================================================================

// =============================================================================
// EIP-712 DOMAIN PARAMETERS - CRITICAL!
// =============================================================================
// These MUST match exactly or signature verification will fail!
//
// Common Pitfall from official docs:
// WRONG:   { name: 'Bridged USDC', version: '2' }
// CORRECT: { name: 'Bridged USDC (Stargate)', version: '1' }

export const EIP712_DOMAIN = {
  /** Token name for EIP-712 domain - MUST be exact */
  NAME: 'Bridged USDC (Stargate)',
  /** Version for EIP-712 domain - MUST be '1' */
  VERSION: '1',
} as const;

// =============================================================================
// Network Configuration
// =============================================================================

export const CRONOS_NETWORKS = {
  TESTNET: {
    name: 'Cronos Testnet',
    chainId: 338,
    networkId: 'cronos-testnet',
    rpcUrl: 'https://evm-t3.cronos.org',
    explorerUrl: 'https://explorer.cronos.org/testnet',
    // devUSDC.e - Bridged USDC (Stargate) - EIP-3009 compatible
    usdcAddress: '0xc01efAaF7C5C61bEbFAeb358E1161b537b8bC0e0',  // ✅ TESTNET
    usdcDecimals: 6,
    eip712: {
      name: EIP712_DOMAIN.NAME,
      version: EIP712_DOMAIN.VERSION,
    },
  },
  MAINNET: {
    name: 'Cronos Mainnet',
    chainId: 25,
    networkId: 'cronos-mainnet',
    rpcUrl: 'https://evm.cronos.org',
    explorerUrl: 'https://explorer.cronos.org',
    // USDC.e - Bridged USDC (Stargate) - EIP-3009 compatible
    usdcAddress: '0xf951eC28187D9E5Ca673Da8FE6757E6f0Be5F77C',  // ✅ MAINNET
    usdcDecimals: 6,
    eip712: {
      name: EIP712_DOMAIN.NAME,
      version: EIP712_DOMAIN.VERSION,
    },
  },
} as const;

// =============================================================================
// Facilitator Configuration
// =============================================================================

export const FACILITATOR_URL = 'https://facilitator.cronoslabs.org/v2/x402';

export const FACILITATOR_ENDPOINTS = {
  VERIFY: '/verify',
  SETTLE: '/settle',
  HEALTH: '/health',
} as const;

// =============================================================================
// x402 Protocol Constants
// =============================================================================

export const X402_VERSION = 1;

export const PAYMENT_SCHEMES = {
  EXACT: 'exact',
} as const;

// =============================================================================
// EIP-712 Type Definitions (for TransferWithAuthorization - EIP-3009)
// =============================================================================

export const EIP712_TYPES = {
  TransferWithAuthorization: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'validAfter', type: 'uint256' },
    { name: 'validBefore', type: 'uint256' },
    { name: 'nonce', type: 'bytes32' },
  ],
} as const;

// =============================================================================
// Timeouts
// =============================================================================

export const TIMEOUTS = {
  /** Payment validity window in seconds */
  PAYMENT_VALIDITY: 300,
  /** Verify request timeout in seconds */
  VERIFY: 30,
  /** Settle request timeout in seconds */
  SETTLE: 60,
} as const;

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get network configuration by network name
 */
export function getNetworkConfig(network: 'testnet' | 'mainnet') {
  return network === 'mainnet' ? CRONOS_NETWORKS.MAINNET : CRONOS_NETWORKS.TESTNET;
}

/**
 * Convert USD to base units (6 decimals for USDC)
 */
export function usdToBaseUnits(usd: number): string {
  return Math.floor(usd * 1_000_000).toString();
}

/**
 * Convert base units to USD
 */
export function baseUnitsToUsd(baseUnits: string): number {
  return parseInt(baseUnits) / 1_000_000;
}

/**
 * Format USDC amount for display
 */
export function formatUsdc(baseUnits: string): string {
  const usd = baseUnitsToUsd(baseUnits);
  return `$${usd.toFixed(6)} USDC`;
}

/**
 * Create EIP-712 domain for signing - uses OFFICIAL parameters
 */
export function createEIP712Domain(
  network: 'testnet' | 'mainnet',
  verifyingContract: string
) {
  const config = getNetworkConfig(network);
  return {
    name: config.eip712.name,      // "Bridged USDC (Stargate)"
    version: config.eip712.version, // "1"
    chainId: config.chainId,
    verifyingContract,
  };
}
// =============================================================================
// Backward Compatibility Aliases
// =============================================================================

export const EIP712_DOMAIN_TESTNET = {
  name: EIP712_DOMAIN.NAME,
  version: EIP712_DOMAIN.VERSION,
  chainId: CRONOS_NETWORKS.TESTNET.chainId,
};

export const EIP712_DOMAIN_MAINNET = {
  name: EIP712_DOMAIN.NAME,
  version: EIP712_DOMAIN.VERSION,
  chainId: CRONOS_NETWORKS.MAINNET.chainId,
};

export const X402_CONSTANTS = {
  VERSION: X402_VERSION,
  USDC_DECIMALS: 6,
  PAYMENT_VALIDITY_SECONDS: TIMEOUTS.PAYMENT_VALIDITY,
};