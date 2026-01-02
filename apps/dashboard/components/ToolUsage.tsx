'use client';

import { ToolStats, formatUSDC } from '@/lib/api';

interface ToolUsageProps {
  stats: ToolStats[];
}

export function ToolUsage({ stats }: ToolUsageProps) {
  if (stats.length === 0) {
    return (
      <div className="text-gray-500 text-center py-8">
        No tool calls yet
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {stats.map((tool) => (
        <div key={tool.name} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div>
            <h4 className="font-medium">{tool.name}</h4>
            <p className="text-sm text-gray-500">{tool.calls} calls</p>
          </div>
          <div className="text-right">
            <p className="font-semibold text-cronos-blue">{formatUSDC(tool.revenue)}</p>
            <p className="text-xs text-gray-500">revenue</p>
          </div>
        </div>
      ))}
    </div>
  );
}