// =============================================================================
// Dashboard API Client
// =============================================================================

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export interface Payment {
  id: string;
  toolName: string;
  amount: string;
  payer: string;
  txHash: string;
  timestamp: number;
  status: 'pending' | 'settled' | 'failed';
}

export interface ToolStats {
  name: string;
  calls: number;
  revenue: string;
}

export async function getPayments(): Promise<Payment[]> {
  const res = await fetch(`${API_URL}/api/payments`);
  if (!res.ok) throw new Error('Failed to fetch payments');
  return res.json();
}

export async function getToolStats(): Promise<ToolStats[]> {
  const res = await fetch(`${API_URL}/api/stats/tools`);
  if (!res.ok) throw new Error('Failed to fetch tool stats');
  return res.json();
}

export async function getTotalRevenue(): Promise<string> {
  const res = await fetch(`${API_URL}/api/stats/revenue`);
  if (!res.ok) throw new Error('Failed to fetch revenue');
  const data = await res.json();
  return data.total;
}

export function formatUSDC(baseUnits: string): string {
  const usd = parseInt(baseUnits, 10) / 1_000_000;
  return `$${usd.toFixed(6)}`;
}

export function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function shortenTxHash(hash: string): string {
  return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
}

export function getExplorerUrl(txHash: string, network: 'testnet' | 'mainnet' = 'testnet'): string {
  const base = network === 'testnet' 
    ? 'https://explorer.cronos.org/testnet'
    : 'https://explorer.cronos.org';
  return `${base}/tx/${txHash}`;
}