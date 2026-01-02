// =============================================================================
// @cronos-mcp/payment - Payment Handler
// =============================================================================

import {
  PaymentRequirements,
  PaymentRecord,
  PricedTool,
} from '@cronos-mcp/core';
import { CRONOS_NETWORKS } from '@cronos-mcp/core';
import { FacilitatorClient } from './facilitator.js';

export interface PaymentHandlerConfig {
  paymentAddress: string;
  network: 'testnet' | 'mainnet';
  facilitatorUrl?: string;
}

/**
 * Handles x402 payment processing for MCP servers
 */
export class PaymentHandler {
  private facilitator: FacilitatorClient;
  private paymentAddress: string;
  private network: 'testnet' | 'mainnet';
  private payments: Map<string, PaymentRecord> = new Map();

  constructor(config: PaymentHandlerConfig) {
    this.paymentAddress = config.paymentAddress;
    this.network = config.network;
    this.facilitator = new FacilitatorClient(
      config.facilitatorUrl ?? 'https://facilitator.cronoslabs.org/v2/x402'
    );
  }

  /**
   * Create payment requirements for a tool
   */
  createPaymentRequirements(tool: PricedTool, resource: string): PaymentRequirements {
    const networkConfig = this.network === 'mainnet' 
      ? CRONOS_NETWORKS.MAINNET 
      : CRONOS_NETWORKS.TESTNET;

    return {
      scheme: 'exact',
      network: networkConfig.networkId,
      maxAmountRequired: tool.price,
      resource,
      description: tool.description,
      mimeType: 'application/json',
      payTo: this.paymentAddress,
      maxTimeoutSeconds: 300,
      asset: networkConfig.usdcAddress,
    };
  }

  /**
   * Create 402 Payment Required response
   */
  create402Response(tool: PricedTool, resource: string): {
    status: number;
    body: {
      error: string;
      paymentRequirements: PaymentRequirements;
      accepts: PaymentRequirements[];
    };
  } {
    const requirements = this.createPaymentRequirements(tool, resource);
    
    return {
      status: 402,
      body: {
        error: 'Payment Required',
        paymentRequirements: requirements,
        accepts: [requirements],
      },
    };
  }

  /**
   * Process a payment from X-PAYMENT header
   * @param paymentHeader - Raw base64 encoded payment header from client (NOT parsed)
   * @param tool - The tool being paid for
   * @param resource - The resource URI
   */
  async processPayment(
    paymentHeader: string,
    tool: PricedTool,
    resource: string
  ): Promise<PaymentRecord> {
    const paymentRequirements = this.createPaymentRequirements(tool, resource);

    // Verify payment - pass raw base64 header directly to facilitator
    const verifyResult = await this.facilitator.verify(paymentHeader, paymentRequirements);
    
    if (!verifyResult.isValid) {
      throw new Error(`Payment invalid: ${verifyResult.invalidReason || 'unknown'}`);
    }

    // Settle payment - pass raw base64 header directly to facilitator
    const settleResult = await this.facilitator.settle(paymentHeader, paymentRequirements);
    
    if (!settleResult.success) {
      throw new Error(`Settlement failed: ${settleResult.errorReason || 'unknown'}`);
    }

    // Create payment record
   const record: PaymentRecord = {
      id: crypto.randomUUID(),
      toolName: tool.name,
      amount: tool.price,
      payer: verifyResult.payer || 'unknown',
      txHash: settleResult.transaction || '',  // FIXED: provide default
      timestamp: Date.now(),
      status: 'settled',
    };

    this.payments.set(record.id, record);
    return record;
  }

  /**
   * Get all payment records
   */
  getPayments(): PaymentRecord[] {
    return Array.from(this.payments.values());
  }

  /**
   * Get payment by ID
   */
  getPayment(id: string): PaymentRecord | undefined {
    return this.payments.get(id);
  }

  /**
   * Get payments by payer address
   */
  getPaymentsByPayer(payer: string): PaymentRecord[] {
    return Array.from(this.payments.values())
      .filter(p => p.payer.toLowerCase() === payer.toLowerCase());
  }

  /**
   * Get total revenue
   */
  getTotalRevenue(): bigint {
    return Array.from(this.payments.values())
      .reduce((sum, p) => sum + BigInt(p.amount), BigInt(0));
  }
}

/**
 * Create a payment handler
 */
export function createPaymentHandler(config: PaymentHandlerConfig): PaymentHandler {
  return new PaymentHandler(config);
}