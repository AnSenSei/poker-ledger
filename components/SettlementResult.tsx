'use client';

import { forwardRef, useState } from 'react';
import { Transfer } from '@/lib/types';
import { formatSettlementText } from '@/lib/settlement';
import { useToast } from './Toast';

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
    const [copied, setCopied] = useState(false);
    const [sharing, setSharing] = useState(false);
    const { toast } = useToast();

    function handleCopy() {
      const text = formatSettlementText(settlements, sessionNote);
      navigator.clipboard.writeText(text);
      setCopied(true);
      toast('已复制到剪贴板', 'success');
      setTimeout(() => setCopied(false), 2000);
    }

    async function handleShareImage() {
      const el = (ref as React.RefObject<HTMLDivElement>)?.current;
      if (!el) return;
      setSharing(true);
      try {
        const html2canvas = (await import('html2canvas')).default;
        const canvas = await html2canvas(el, {
          backgroundColor: '#1f2937',
          scale: 2,
        });
        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, 'image/png')
        );
        if (!blob) throw new Error('Failed to create image');

        if (
          navigator.share &&
          navigator.canShare?.({
            files: [
              new File([blob], 'settlement.png', { type: 'image/png' }),
            ],
          })
        ) {
          await navigator.share({
            files: [
              new File([blob], '结算单.png', { type: 'image/png' }),
            ],
          });
        } else {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = '结算单.png';
          a.click();
          URL.revokeObjectURL(url);
        }
      } catch (err) {
        console.error(err);
        toast('分享失败');
      }
      setSharing(false);
    }

    if (settlements.length === 0) return null;

    const profitList = entries
      ? [...entries]
          .map((e) => ({ name: e.name, net: e.cashOut - e.buyIn }))
          .sort((a, b) => b.net - a.net)
      : [];

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
                      {p.net > 0 ? '+' : ''}{p.net}
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
                <span className="font-mono font-bold">{t.amount}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-2 mt-3 mb-6">
          <button
            onClick={handleCopy}
            className="flex-1 bg-gray-700 hover:bg-gray-600 rounded-lg py-2 text-sm transition-colors press-effect"
          >
            {copied ? '✓ 已复制' : '📋 复制'}
          </button>
          <button
            onClick={handleShareImage}
            disabled={sharing}
            className="flex-1 bg-green-600 hover:bg-green-700 rounded-lg py-2 text-sm transition-colors disabled:bg-gray-700 press-effect"
          >
            {sharing ? '生成中...' : '📷 分享图片'}
          </button>
        </div>
      </div>
    );
  }
);

export default SettlementResult;
