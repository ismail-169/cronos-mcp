// =============================================================================
// @cronos-mcp/payment - Cronos x402 Facilitator Client
// Docs: https://docs.cronos.org/cronos-x402-facilitator/api-reference
// =============================================================================

import { FACILITATOR_ENDPOINTS, TIMEOUTS } from '@cronos-mcp/core';
import type { PaymentRequirements } from '@cronos-mcp/core';

/**
 * Request body for POST /verify
 */
export interface FacilitatorVerifyRequest {
  x402Version: number;
  paymentHeader: string;
  paymentRequirements: PaymentRequirements;
}

/**
 * Request body for POST /settle
 */
export interface FacilitatorSettleRequest {
  x402Version: number;
  paymentHeader: string;
  paymentRequirements: PaymentRequirements;
}

/**
 * Response from POST /verify
 */
export interface VerifyResponse {
  isValid: boolean;
  invalidReason?: string | null;
  payer?: string;
}

/**
 * Response from POST /settle (success)
 */
export interface SettleResponse {
  success: boolean;
  event?: string;
  txHash?: string;
  transaction?: string;
  from?: string;
  to?: string;
  value?: string;
  blockNumber?: number;
  network?: string;
  timestamp?: string;
  error?: string;
  errorReason?: string;
}

/**
 * Simple retry helper
 */
async function retry<T>(
  fn: () => Promise<T>,
  retries: number,
  delay: number = 1000
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
      }
    }
  }
  
  throw lastError;
}

/**
 * Cronos x402 Facilitator API Client
 * Handles payment verification and settlement
 */
export class FacilitatorClient {
  private baseUrl: string;
  private timeout: number;
  private retries: number;

  constructor(
    baseUrl: string = 'https://facilitator.cronoslabs.org/v2/x402',
    options: { timeout?: number; retries?: number } = {}
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.timeout = options.timeout ?? TIMEOUTS.VERIFY * 1000;
    this.retries = options.retries ?? 3;
  }

  /**
   * Verify a payment payload against requirements
   */
  async verify(
    paymentHeader: string,
    paymentRequirements: PaymentRequirements
  ): Promise<VerifyResponse> {
    const request = {
      x402Version: 1,
      paymentHeader,
      paymentRequirements,
    };

    console.log('[Facilitator] Verify request:', JSON.stringify(request, null, 2));

    return retry(
      async () => {
        const response = await fetch(
          `${this.baseUrl}${FACILITATOR_ENDPOINTS.VERIFY}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X402-Version': '1',
            },
            body: JSON.stringify(request),
            signal: AbortSignal.timeout(this.timeout),
          }
        );

        const responseText = await response.text();
        console.log('[Facilitator] Verify response:', response.status, responseText);

        if (!response.ok) {
          throw new Error(`Verify failed: ${response.status} - ${responseText}`);
        }

        return JSON.parse(responseText) as VerifyResponse;
      },
      this.retries
    );
  }

  /**
   * Settle a verified payment on-chain
   */
  async settle(
    paymentHeader: string,
    paymentRequirements: PaymentRequirements
  ): Promise<SettleResponse> {
    const request = {
      x402Version: 1,
      paymentHeader,
      paymentRequirements,
    };

    console.log('[Facilitator] Settle request:', JSON.stringify(request, null, 2));

    return retry(
      async () => {
        const response = await fetch(
          `${this.baseUrl}${FACILITATOR_ENDPOINTS.SETTLE}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X402-Version': '1',
            },
            body: JSON.stringify(request),
            signal: AbortSignal.timeout(this.timeout),
          }
        );

        const responseText = await response.text();
        console.log('[Facilitator] Settle response:', response.status, responseText);

        if (!response.ok) {
          throw new Error(`Settle failed: ${response.status} - ${responseText}`);
        }

        const data = JSON.parse(responseText);
        
        // Map the Facilitator response format to our expected format
        return {
          success: data.event === 'payment.settled',
          event: data.event,
          txHash: data.txHash,
          transaction: data.txHash,
          from: data.from,
          to: data.to,
          value: data.value,
          blockNumber: data.blockNumber,
          network: data.network,
          timestamp: data.timestamp,
          error: data.error,
          errorReason: data.error,
        } as SettleResponse;
      },
      this.retries
    );
  }

  /**
   * Check facilitator health
   */
  async health(): Promise<boolean> {
    try {
      const response = await fetch(
        'https://facilitator.cronoslabs.org/healthcheck',
        {
          method: 'GET',
          signal: AbortSignal.timeout(5000),
        }
      );
      return response.ok;
    } catch {
      return false;
    }
  }
}