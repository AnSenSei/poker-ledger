'use client';

import { forwardRef } from 'react';
import { Transfer } from '@/lib/types';

interface PlayerProfit {
  name: string;
  buyIn: number;
  cashOut: number;
}

interface Props {
  settlements: Transfer[];
  sessionNote?: string | null;
  entries?: PlayerProfit[];
}

const SettlementResult = forwardRef<HTMLDivElement, Props>(
  function SettlementResult({ settlements, sessionNote, entries }, ref) {
    if (settlements.length === 0) return null;

    const profitList = entries
      ? [...entries]
          .map((e) => ({ name: e.name, net: (e.cashOut - e.buyIn) / 4 }))
          .sort((a, b) => b.net - a.net)
      : [];

    function fmt(n: number): string {
      return n % 1 === 0 ? String(n) : n.toFixed(2);
    }

    return (
      <div>
        <div ref={ref} className="bg-gray-800 rounded-xl p-4">
          <h2 className="font-semibold mb-1 text-green-400">
            💰 结算单
          </h2>
          {sessionNote && (
            <p className="text-gray-500 text-sm mb-3">{sessionNote}</p>
          )}

          {/* Per-player profit summary */}
          {profitList.length > 0 && (
            <div className="mb-4">
              <div className="text-xs text-gray-500 mb-2">每人盈亏</div>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {profitList.map((p) => (
                  <span key={p.name} className="text-sm">
                    <span className="text-gray-300">{p.name}</span>{' '}
                    <span
                      className={`font-mono font-bold ${
                        p.net > 0
                          ? 'text-green-400'
                          : p.net < 0
                          ? 'text-red-400'
                          : 'text-gray-400'
                      }`}
                    >
                      {p.net > 0 ? '+' : ''}¥{fmt(p.net)}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Transfer list */}
          <div className="space-y-2">
            {profitList.length > 0 && (
              <div className="text-xs text-gray-500 mb-1">转账明细</div>
            )}
            {settlements.map((t, i) => (
              <div
                key={i}
                className="flex items-center justify-between py-2 border-b border-gray-700 last:border-0"
              >
                <span>
                  <span className="text-red-400">{t.from}</span>
                  {' → '}
                  <span className="text-green-400">{t.to}</span>
                </span>
                <span className="font-mono font-bold">¥{fmt(t.amount / 4)}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    );
  }
);

export default SettlementResult;
