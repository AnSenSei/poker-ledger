'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="zh-CN">
      <body className="antialiased bg-gray-900 text-gray-100 min-h-screen">
        <div className="flex flex-col items-center justify-center min-h-screen p-4">
          <div className="text-4xl mb-4">😵</div>
          <h2 className="text-xl font-bold mb-2">出错了</h2>
          <p className="text-gray-400 text-sm mb-6 text-center max-w-xs">
            {error.message || '发生了意外错误'}
          </p>
          <button
            onClick={reset}
            className="bg-green-600 hover:bg-green-700 text-white rounded-xl px-6 py-3 font-medium transition-colors"
          >
            重试
          </button>
        </div>
      </body>
    </html>
  );
}
