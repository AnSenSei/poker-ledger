'use client';

const THRESHOLD = 80;

export default function PullIndicator({
  pullDistance,
  refreshing,
}: {
  pullDistance: number;
  refreshing: boolean;
}) {
  if (pullDistance === 0 && !refreshing) return null;

  const progress = Math.min(pullDistance / THRESHOLD, 1);

  return (
    <div
      className="flex justify-center overflow-hidden transition-all duration-200"
      style={{ height: refreshing ? 40 : pullDistance > 0 ? pullDistance * 0.5 : 0 }}
    >
      <div className="flex items-center gap-2 text-sm text-gray-400">
        {refreshing ? (
          <>
            <span className="animate-spin">↻</span>
            <span>刷新中...</span>
          </>
        ) : (
          <>
            <span
              className="transition-transform duration-150"
              style={{ transform: `rotate(${progress * 180}deg)` }}
            >
              ↓
            </span>
            <span>{progress >= 1 ? '松开刷新' : '下拉刷新'}</span>
          </>
        )}
      </div>
    </div>
  );
}
