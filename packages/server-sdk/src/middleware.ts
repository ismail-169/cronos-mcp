// =============================================================================
// @cronos-mcp/server-sdk - x402 Payment Middleware
// =============================================================================

import { PricedTool, PaymentRecord } from '@cronos-mcp/core';
import { PaymentHandler } from '@cronos-mcp/payment';

export interface MiddlewareContext {
  tool: PricedTool;
  paymentHeader?: string;
  params: Record<string, unknown>;
}

export interface MiddlewareResult {
  proceed: boolean;
  paymentRequired?: {
    status: number;
    body: unknown;
  };
  payment?: PaymentRecord;
  error?: string;
}

/**
 * x402 Payment middleware for MCP tools
 */
export class X402Middleware {
  private paymentHandler: PaymentHandler;

  constructor(paymentHandler: PaymentHandler) {
    this.paymentHandler = paymentHandler;
  }

  /**
   * Process a tool call with payment handling
   */
  async process(context: MiddlewareContext): Promise<MiddlewareResult> {
    const { tool, paymentHeader, params } = context;
    const price = BigInt(tool.price);

    // Free tools pass through
    if (price === BigInt(0)) {
      return { proceed: true };
    }

    // No payment header - return 402
    if (!paymentHeader) {
      const response = this.paymentHandler.create402Response(
        tool,
        `tool://${tool.name}`
      );
      return {
        proceed: false,
        paymentRequired: response,
      };
    }

    // Process payment
    try {
      const payment = await this.paymentHandler.processPayment(
        paymentHeader,
        tool,
        `tool://${tool.name}`
      );
      return {
        proceed: true,
        payment,
      };
    } catch (error) {
      return {
        proceed: false,
        error: error instanceof Error ? error.message : 'Payment failed',
      };
    }
  }
}

/**
 * Create x402 middleware instance
 */
export function createMiddleware(paymentHandler: PaymentHandler): X402Middleware {
  return new X402Middleware(paymentHandler);
}