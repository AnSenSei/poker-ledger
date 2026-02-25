'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/Toast';
import { LeaderboardSkeleton } from '@/components/Skeleton';

interface EntryRow {
  player_id: string;
  buy_in: number;
  cash_out: number;
  players: { id: string; name: string };
  sessions: { created_at: string };
}

interface PlayerStats {
  id: string;
  name: string;
  totalSessions: number;
  totalProfit: number;
  avgProfit: number;
  winRate: number;
  maxWin: number;
  maxLoss: number;
}

type SortKey = 'totalProfit' | 'winRate' | 'totalSessions' | 'avgProfit';
type Period = 'all' | '30d' | '90d';

export default function LeaderboardPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [allEntries, setAllEntries] = useState<EntryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortKey>('totalProfit');
  const [period, setPeriod] = useState<Period>('all');

  useEffect(() => {
    fetchLeaderboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchLeaderboard() {
    try {
      const { data: entries, error } = await supabase
        .from('entries')
        .select('player_id, buy_in, cash_out, players(id, name), sessions(created_at)')
        .not('cash_out', 'is', null);

      if (error) throw error;
      setAllEntries((entries as unknown as EntryRow[]) ?? []);
    } catch (err) {
      toast('加载排行榜失败: ' + (err instanceof Error ? err.message : ''));
    } finally {
      setLoading(false);
    }
  }

  // Compute stats from filtered entries
  const filteredEntries = allEntries.filter((e) => {
    if (period === 'all') return true;
    const days = period === '30d' ? 30 : 90;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return new Date(e.sessions.created_at) >= cutoff;
  });

  const stats: PlayerStats[] = (() => {
    const playerMap = new Map<string, { name: string; profits: number[] }>();
    for (const e of filteredEntries) {
      const player = e.players;
      const net = Number(e.cash_out) - Number(e.buy_in);
      if (!playerMap.has(player.id)) {
        playerMap.set(player.id, { name: player.name, profits: [] });
      }
      playerMap.get(player.id)!.profits.push(net);
    }
    const result: PlayerStats[] = [];
    for (const [id, { name, profits }] of playerMap) {
      const totalProfit = profits.reduce((s, p) => s + p, 0);
      const totalSessions = profits.length;
      const wins = profits.filter((p) => p > 0).length;
      result.push({
        id,
        name,
        totalSessions,
        totalProfit: Math.round(totalProfit),
        avgProfit: totalSessions > 0 ? Math.round(totalProfit / totalSessions) : 0,
        winRate: totalSessions > 0 ? Math.round((wins / totalSessions) * 100) : 0,
        maxWin: profits.length > 0 ? Math.max(...profits) : 0,
        maxLoss: profits.length > 0 ? Math.min(...profits) : 0,
      });
    }
    return result;
  })();

  const sorted = [...stats].sort((a, b) => {
    if (sortBy === 'totalProfit') return b.totalProfit - a.totalProfit;
    if (sortBy === 'winRate') return b.winRate - a.winRate;
    if (sortBy === 'totalSessions') return b.totalSessions - a.totalSessions;
    if (sortBy === 'avgProfit') return b.avgProfit - a.avgProfit;
    return 0;
  });

  const sortOptions: { key: SortKey; label: string }[] = [
    { key: 'totalProfit', label: '总盈亏' },
    { key: 'avgProfit', label: '场均' },
    { key: 'winRate', label: '胜率' },
    { key: 'totalSessions', label: '场次' },
  ];

  if (loading) {
    return (
      <div className="max-w-lg mx-auto p-4 pb-8">
        <div className="text-center pt-6 pb-6">
          <h1 className="text-2xl font-bold">🏆 排行榜</h1>
        </div>
        <LeaderboardSkeleton />
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto p-4 pb-8">
      {/* Header */}
      <div className="text-center pt-6 pb-6">
        <h1 className="text-2xl font-bold">🏆 排行榜</h1>
      </div>

      {/* Time Period Filter */}
      <div className="flex gap-2 mb-4">
        {([['all', '全部'], ['30d', '近30天'], ['90d', '近90天']] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setPeriod(key)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              period === key
                ? 'bg-green-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Sort Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto">
        {sortOptions.map((opt) => (
          <button
            key={opt.key}
            onClick={() => setSortBy(opt.key)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              sortBy === opt.key
                ? 'bg-green-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Leaderboard */}
      {sorted.length === 0 ? (
        <p className="text-gray-500 text-center py-8">还没有已结算的记录</p>
      ) : (
        <div className="space-y-3">
          {sorted.map((p, index) => {
            const medal =
              index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : null;

            return (
              <button
                key={p.id}
                onClick={() => router.push(`/stats/${p.id}`)}
                className="w-full bg-gray-800 rounded-xl p-4 flex items-center gap-4 text-left active:bg-gray-700 transition-colors"
              >
                {/* Rank */}
                <div className="w-8 text-center flex-shrink-0">
                  {medal ? (
                    <span className="text-xl">{medal}</span>
                  ) : (
                    <span className="text-gray-500 font-mono text-sm">
                      {index + 1}
                    </span>
                  )}
                </div>

                {/* Name & details */}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-lg truncate">{p.name}</div>
                  <div className="flex gap-3 text-xs text-gray-500 mt-1">
                    <span>{p.totalSessions}场</span>
                    <span>胜率{p.winRate}%</span>
                    <span>场均{p.avgProfit > 0 ? '+' : ''}{p.avgProfit}</span>
                  </div>
                </div>

                {/* Total profit */}
                <div className="flex-shrink-0 text-right">
                  <div
                    className={`text-xl font-bold font-mono ${
                      p.totalProfit > 0
                        ? 'text-green-400'
                        : p.totalProfit < 0
                        ? 'text-red-400'
                        : 'text-gray-400'
                    }`}
                  >
                    {p.totalProfit > 0 ? '+' : ''}
                    {p.totalProfit}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
