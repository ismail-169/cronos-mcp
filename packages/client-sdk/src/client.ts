// =============================================================================
// @cronos-mcp/client-sdk - MCP Client with x402 Payments
// =============================================================================
// FIXED: Payload structure corrected to match official Cronos x402 spec
// =============================================================================

import { ethers } from 'ethers';
import {
  MCPClientConfig,
  PaymentRequirements,
  PaymentRequiredResponse,
  CRONOS_NETWORKS,
  EIP712_DOMAIN_TESTNET,
  X402_CONSTANTS,
} from '@cronos-mcp/core';
import { generateNonce, calculateValidBefore } from '@cronos-mcp/core';
import { BudgetManager, createBudgetManager } from './budget.js';
import { ServiceRegistry, createRegistry, DiscoveredService } from './registry.js';

export interface CallToolResult {
  result: unknown;
  payment?: {
    amount: string;
    txHash: string;
  };
}

interface ToolResponse {
  result: unknown;
  payment?: {
    txHash: string;
  };
}

interface ErrorResponse {
  error: string;
}

// =============================================================================
// CORRECTED Payment Payload Type (matches official Cronos x402 format)
// =============================================================================
// The official structure is FLAT, not nested with 'authorization'
interface CronosPaymentPayload {
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
 * MCP Client with automatic x402 payment handling
 */
export class MCPClient {
  private config: MCPClientConfig;
  private wallet?: ethers.Wallet;
  private budget: BudgetManager;
  private registry: ServiceRegistry;

  constructor(config: MCPClientConfig) {
    this.config = config;
    
    // Setup wallet if private key provided
    if (config.privateKey) {
      const networkConfig = config.network === 'mainnet'
        ? CRONOS_NETWORKS.MAINNET
        : CRONOS_NETWORKS.TESTNET;
      const provider = new ethers.JsonRpcProvider(networkConfig.rpcUrl);
      this.wallet = new ethers.Wallet(config.privateKey, provider);
    }

    // Setup budget manager
    this.budget = createBudgetManager(config.maxBudget || '0');
    
    // Setup registry
    this.registry = createRegistry(config);
  }

  /**
   * Create signed payment header
   * 
   * FIXED: Now creates the correct FLAT payload structure required by
   * the Cronos Facilitator API, with 'asset' field included.
   */
  private async createPaymentHeader(
    requirements: PaymentRequirements
  ): Promise<string> {
    if (!this.wallet) {
      throw new Error('Wallet not configured - cannot sign payments');
    }

    const nonce = generateNonce();
    const validBefore = calculateValidBefore(requirements.maxTimeoutSeconds);
    
    const networkConfig = this.config.network === 'mainnet'
      ? CRONOS_NETWORKS.MAINNET
      : CRONOS_NETWORKS.TESTNET;

    // EIP-712 domain - uses correct parameters
    const domain = {
      name: EIP712_DOMAIN_TESTNET.name,     // "Bridged USDC (Stargate)"
      version: EIP712_DOMAIN_TESTNET.version, // "1"
      chainId: networkConfig.chainId,
      verifyingContract: requirements.asset,
    };

    // EIP-712 types
    const types = {
      TransferWithAuthorization: [
        { name: 'from', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'validAfter', type: 'uint256' },
        { name: 'validBefore', type: 'uint256' },
        { name: 'nonce', type: 'bytes32' },
      ],
    };

    // Message to sign
    const message = {
      from: this.wallet.address,
      to: requirements.payTo,
      value: BigInt(requirements.maxAmountRequired),
      validAfter: 0,
      validBefore,
      nonce,
    };

    // Sign typed data
    const signature = await this.wallet.signTypedData(
      domain,
      types,
      message
    );

    // =========================================================================
    // BUILD PAYLOAD - OFFICIAL CRONOS X402 STRUCTURE
    // =========================================================================
    // CRITICAL FIX: Structure is FLAT (not nested with 'authorization')
    // CRITICAL FIX: 'asset' field MUST be included
    //
    // Official structure from Cronos docs:
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

    const payload: CronosPaymentPayload = {
      x402Version: X402_CONSTANTS.VERSION,
      scheme: requirements.scheme,
      network: requirements.network,
      payload: {
        from: this.wallet.address,
        to: requirements.payTo,
        value: requirements.maxAmountRequired,
        validAfter: 0,
        validBefore,
        nonce,
        signature,
        asset: requirements.asset,  // ✅ REQUIRED by Cronos Facilitator
      },
    };

    // Base64 encode (direct encoding, not using encodePaymentHeader)
    return Buffer.from(JSON.stringify(payload)).toString('base64');
  }

  /**
   * Call a tool on a server with automatic payment handling
   */
  async callTool(
    serverUrl: string,
    toolName: string,
    params: Record<string, unknown>
  ): Promise<CallToolResult> {
    // Initial request
    const response = await fetch(`${serverUrl}/tools/${toolName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    // Success - no payment needed
    if (response.ok) {
      const data = await response.json() as ToolResponse;
      return { result: data.result };
    }

    // Payment required
    if (response.status === 402) {
      const data = await response.json() as PaymentRequiredResponse;
      const requirements = data.paymentRequirements;
      const amount = requirements.maxAmountRequired;

      // Check budget
      if (!this.budget.canSpend(amount)) {
        throw new Error(`Insufficient budget: need ${amount}, have ${this.budget.getRemaining()}`);
      }

      // Create and sign payment
      const paymentHeader = await this.createPaymentHeader(requirements);

      // Retry with payment
      const paidResponse = await fetch(`${serverUrl}/tools/${toolName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-PAYMENT': paymentHeader,
        },
        body: JSON.stringify(params),
      });

      if (!paidResponse.ok) {
        const errorData = await paidResponse.json() as ErrorResponse;
        throw new Error(`Payment failed: ${errorData.error || 'Unknown error'}`);
      }

      const result = await paidResponse.json() as ToolResponse;

      // Record spending
      this.budget.recordSpending({
        toolName,
        serverUrl,
        amount,
        txHash: result.payment?.txHash || '',
      });

      return {
        result: result.result,
        payment: {
          amount,
          txHash: result.payment?.txHash || '',
        },
      };
    }

    // Other error
    const errorData = await response.json() as ErrorResponse;
    throw new Error(`Tool call failed: ${errorData.error || response.statusText}`);
  }

  /**
   * Add a service to the registry
   */
  async addService(url: string): Promise<DiscoveredService> {
    return this.registry.addService(url);
  }

  /**
   * Get budget state
   */
  getBudget() {
    return this.budget.getState();
  }

  /**
   * Get all registered services
   */
  getServices() {
    return this.registry.getAllServices();
  }

  /**
   * Get all available tools
   */
  getTools() {
    return this.registry.getAllTools();
  }

  /**
   * Get wallet address
   */
  getAddress(): string | undefined {
    return this.wallet?.address;
  }
}

/**
 * Create an MCP client
 */
export function createClient(config: MCPClientConfig): MCPClient {
  return new MCPClient(config);
}