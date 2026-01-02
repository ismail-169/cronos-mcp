// =============================================================================
// @cronos-mcp/core - Type Definitions
// From: https://docs.cronos.org/cronos-x402-facilitator/api-reference
// =============================================================================
// FIXED: PaymentPayload now matches official Cronos x402 structure
// =============================================================================

/**
 * Payment payload structure - OFFICIAL Cronos x402 format
 * 
 * Source: https://docs.cronos.org/cronos-x402-facilitator/api-reference
 * 
 * CRITICAL: The payload is FLAT, not nested with 'authorization'
 */
export interface PaymentPayload {
  x402Version: number;
  scheme: string;
  network: string;  // "cronos-testnet" or "cronos-mainnet"
  payload: {
    from: string;
    to: string;
    value: string;
    validAfter: number;
    validBefore: number;
    nonce: string;
    signature: string;
    asset: string;  // ✅ REQUIRED: USDC contract address
  };
}

/**
 * @deprecated Legacy format - DO NOT USE
 * The old nested authorization structure that was incorrect
 */
export interface LegacyPaymentPayload {
  x402Version: number;
  scheme: string;
  network: string;
  payload: {
    signature: string;
    authorization: {
      from: string;
      to: string;
      value: string;
      validAfter: number;
      validBefore: number;
      nonce: string;
    };
  };
}

/**
 * Payment requirements returned by seller in 402 response
 */
export interface PaymentRequirements {
  scheme: string;
  network: string;  // "cronos-testnet" or "cronos-mainnet"
  maxAmountRequired: string;
  resource: string;
  description?: string;
  mimeType: string;  // REQUIRED by Facilitator
  payTo: string;
  maxTimeoutSeconds: number;
  asset: string;  // USDC contract address
  outputSchema?: Record<string, unknown>;
  extra?: Record<string, unknown>;
}

// =============================================================================
// Facilitator API Types
// From: https://docs.cronos.org/cronos-x402-facilitator/api-reference
// =============================================================================

/**
 * Request body for POST /verify
 */
export interface VerifyRequest {
  x402Version: number;  // Always 1
  paymentHeader: string;  // Base64 encoded PaymentPayload
  paymentRequirements: PaymentRequirements;
}

/**
 * Response from POST /verify
 */
export interface VerifyResponse {
  /** Indicates whether the payment is valid */
  isValid: boolean;
  /** The onchain address of the client that is paying for the resource */
  payer?: string;
  /** The reason the payment is invalid on the x402 protocol */
  invalidReason?: string | null;
}

/**
 * Request body for POST /settle
 */
export interface SettleRequest {
  x402Version: number;  // Always 1
  paymentHeader: string;  // Base64 encoded PaymentPayload
  paymentRequirements: PaymentRequirements;
}

/**
 * Response from POST /settle
 */
export interface SettleResponse {
  /** x402 version */
  x402Version?: number;
  /** Event type: payment.settled or payment.failed */
  event: 'payment.settled' | 'payment.failed';
  /** Transaction hash (on success) */
  txHash?: string;
  /** Payer address */
  from?: string;
  /** Recipient address */
  to?: string;
  /** Amount in base units */
  value?: string;
  /** Block number */
  blockNumber?: number;
  /** Network where settlement occurred */
  network: string;
  /** Timestamp */
  timestamp: string;
  /** Error message (on failure) */
  error?: string;
}

/**
 * Invalid reasons from x402 protocol
 * From: https://docs.cronos.org/cronos-x402-facilitator/api-reference
 */
export type InvalidReason =
  | 'insufficient_funds'
  | 'invalid_scheme'
  | 'invalid_network'
  | 'invalid_x402_version'
  | 'invalid_payment_requirements'
  | 'invalid_payload'
  | 'invalid_exact_evm_payload_authorization_value'
  | 'invalid_exact_evm_payload_authorization_value_too_low'
  | 'invalid_exact_evm_payload_authorization_valid_after'
  | 'invalid_exact_evm_payload_authorization_valid_before'
  | 'invalid_exact_evm_payload_authorization_to'
  | 'invalid_signature'
  | 'nonce_already_used'
  | 'authorization_expired'
  | 'settlement_failed';

// =============================================================================
// MCP Server Types
// =============================================================================

/**
 * Tool definition with pricing
 */
export interface PricedTool {
  name: string;
  description: string;
  price: string;  // In base units (USDC has 6 decimals)
  inputSchema: Record<string, unknown>;
}

/**
 * MCP Server configuration
 */
export interface MCPServerConfig {
  name: string;
  version: string;
  description?: string;
  paymentAddress: string;
  facilitatorUrl?: string;
  network: 'testnet' | 'mainnet';
  tools?: PricedTool[];
}

/**
 * Payment record for tracking
 */
export interface PaymentRecord {
  id: string;
  toolName: string;
  amount: string;
  payer: string;
  txHash: string;
  timestamp: number;
  status: 'pending' | 'settled' | 'failed';
}

// =============================================================================
// Client SDK Types
// =============================================================================

/**
 * Client configuration
 */
export interface MCPClientConfig {
  network: 'testnet' | 'mainnet';
  privateKey?: string;
  walletAddress?: string;
  maxBudget?: string;
  registryUrl?: string;
}

/**
 * Budget tracking
 */
export interface BudgetState {
  total: string;
  spent: string;
  remaining: string;
  transactions: BudgetTransaction[];
}

/**
 * Budget transaction record
 */
export interface BudgetTransaction {
  toolName: string;
  serverUrl: string;
  amount: string;
  txHash: string;
  timestamp: number;
}

/**
 * Service endpoint for registry
 */
export interface ServiceEndpoint {
  url: string;
  name: string;
  description?: string;
  tools: PricedTool[];
}

/**
 * 402 Payment Required response
 */
export interface PaymentRequiredResponse {
  error: string;
  x402Version?: number;
  paymentRequirements: PaymentRequirements;
  accepts?: PaymentRequirements[];
}