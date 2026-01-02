'use client';

import { useState, useEffect } from 'react';
import { Payment, ToolStats, getPayments, getToolStats, getTotalRevenue, formatUSDC } from '@/lib/api';
import { PaymentHistory } from './PaymentHistory';
import { ToolUsage } from './ToolUsage';

export function Dashboard() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [toolStats, setToolStats] = useState<ToolStats[]>([]);
  const [totalRevenue, setTotalRevenue] = useState('0');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [paymentsData, statsData, revenueData] = await Promise.all([
          getPayments(),
          getToolStats(),
          getTotalRevenue(),
        ]);
        setPayments(paymentsData);
        setToolStats(statsData);
        setTotalRevenue(revenueData);
      } catch (err) {
        setError('Failed to load dashboard data');
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
    const interval = setInterval(fetchData, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cronos-blue"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-500">{error}</div>
      </div>
    );
  }

  return (
    <main className="container mx-auto px-4 py-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-cronos-blue">
          CronosMCP Dashboard
        </h1>
        <p className="text-gray-600 mt-2">
          Monitor x402 payments and tool usage
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500">Total Revenue</h3>
          <p className="text-2xl font-bold text-cronos-blue mt-2">
            {formatUSDC(totalRevenue)}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500">Transactions</h3>
          <p className="text-2xl font-bold text-cronos-blue mt-2">
            {payments.length}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500">Active Tools</h3>
          <p className="text-2xl font-bold text-cronos-blue mt-2">
            {toolStats.length}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Recent Payments</h2>
          <PaymentHistory payments={payments.slice(0, 10)} />
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Tool Usage</h2>
          <ToolUsage stats={toolStats} />
        </div>
      </div>
    </main>
  );
}