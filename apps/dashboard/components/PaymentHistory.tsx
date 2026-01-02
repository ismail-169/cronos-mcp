'use client';

import { Payment, formatUSDC, shortenAddress, shortenTxHash, getExplorerUrl } from '@/lib/api';

interface PaymentHistoryProps {
  payments: Payment[];
}

export function PaymentHistory({ payments }: PaymentHistoryProps) {
  if (payments.length === 0) {
    return (
      <div className="text-gray-500 text-center py-8">
        No payments yet
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead>
          <tr>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Tool</th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Payer</th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Tx</th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {payments.map((payment) => (
            <tr key={payment.id}>
              <td className="px-4 py-3 text-sm font-medium">{payment.toolName}</td>
              <td className="px-4 py-3 text-sm">{formatUSDC(payment.amount)}</td>
              <td className="px-4 py-3 text-sm font-mono">{shortenAddress(payment.payer)}</td>
              <td className="px-4 py-3 text-sm">
                <a 
                  href={getExplorerUrl(payment.txHash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cronos-light hover:underline font-mono"
                >
                  {shortenTxHash(payment.txHash)}
                </a>
              </td>
              <td className="px-4 py-3">
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                  payment.status === 'settled' 
                    ? 'bg-green-100 text-green-800'
                    : payment.status === 'failed'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {payment.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}