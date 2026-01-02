// =============================================================================
// @cronos-mcp/client-sdk - Budget Management
// =============================================================================

import { BudgetState, BudgetTransaction } from '@cronos-mcp/core';

/**
 * Budget manager for tracking x402 payments
 */
export class BudgetManager {
  private total: bigint;
  private spent: bigint = BigInt(0);
  private transactions: BudgetTransaction[] = [];

  constructor(totalBudget: string) {
    this.total = BigInt(totalBudget);
  }

  /**
   * Check if amount is within budget
   */
  canSpend(amount: string): boolean {
    return this.spent + BigInt(amount) <= this.total;
  }

  /**
   * Record a spending transaction
   */
  recordSpending(transaction: Omit<BudgetTransaction, 'timestamp'>): void {
    const tx: BudgetTransaction = {
      ...transaction,
      timestamp: Date.now(),
    };
    this.transactions.push(tx);
    this.spent += BigInt(transaction.amount);
  }

  /**
   * Get current budget state
   */
  getState(): BudgetState {
    return {
      total: this.total.toString(),
      spent: this.spent.toString(),
      remaining: (this.total - this.spent).toString(),
      transactions: [...this.transactions],
    };
  }

  /**
   * Get remaining budget
   */
  getRemaining(): bigint {
    return this.total - this.spent;
  }

  /**
   * Get spent amount
   */
  getSpent(): bigint {
    return this.spent;
  }

  /**
   * Reset budget (for new session)
   */
  reset(): void {
    this.spent = BigInt(0);
    this.transactions = [];
  }

  /**
   * Set new total budget
   */
  setTotal(newTotal: string): void {
    this.total = BigInt(newTotal);
  }

  /**
   * Get transaction history
   */
  getTransactions(): BudgetTransaction[] {
    return [...this.transactions];
  }

  /**
   * Get transactions for a specific server
   */
  getTransactionsByServer(serverUrl: string): BudgetTransaction[] {
    return this.transactions.filter(tx => tx.serverUrl === serverUrl);
  }
}

/**
 * Create a budget manager
 */
export function createBudgetManager(totalBudget: string): BudgetManager {
  return new BudgetManager(totalBudget);
}