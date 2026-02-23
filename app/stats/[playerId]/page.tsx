'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Player, Session } from '@/lib/types';
import { formatDateShort } from '@/lib/utils';
import { useToast } from '@/components/Toast';
import ProfitChart from '@/components/ProfitChart';
import SessionChart from '@/components/SessionChart';

interface EntryRow {
  id: string;
  buy_in: number;
  cash_out: number | null;
  sessions: Session;
}

export default function StatsPage() {
  const { playerId } = useParams<{ playerId: string }>();
  const router = useRouter();
  const { toast } = useToast();

  const [player, setPlayer] = useState<Player | null>(null);
  const [entries, setEntries] = useState<EntryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'all' | '30d' | '90d'>('all');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [playerRes, entriesRes] = await Promise.all([
          supabase.from('players').select('*').eq('id', playerId).single(),
          supabase
            .from('entries')
            .select('id, buy_in, cash_out, sessions(*)')
            .eq('player_id', playerId)
            .not('cash_out', 'is', null)
            .order('created_at', { ascending: true }),
        ]);
        if (cancelled) return;
        if (playerRes.error) throw playerRes.error;
        setPlayer(playerRes.data);
        setEntries((entriesRes.data as EntryRow[] | null) ?? []);
      } catch (err) {
        if (!cancelled) toast('加载失败: ' + (err instanceof Error ? err.message : ''));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [playerId, toast]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-400">加载中...</div>
      </div>
    );
  }

  if (!player) {
    return (
      <div className="max-w-lg mx-auto p-4 pt-8 text-center text-gray-400">
        玩家不存在
      </div>
    );
  }

  // ─── Time Filter ───
  const filteredEntries = entries.filter((e) => {
    if (e.cash_out == null) return false;
    if (period === 'all') return true;
    const days = period === '30d' ? 30 : 90;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return new Date(e.sessions.created_at) >= cutoff;
  });

  // ─── Compute Stats ───
  const settledEntries = filteredEntries;
  const totalSessions = settledEntries.length;
  const profits = settledEntries.map(
    (e) => Number(e.cash_out!) - Number(e.buy_in)
  );
  const totalProfit = profits.reduce((sum, p) => sum + p, 0);
  const avgProfit = totalSessions > 0 ? Math.round(totalProfit / totalSessions) : 0;
  const maxWin = profits.length > 0 ? Math.max(...profits) : 0;
  const maxLoss = profits.length > 0 ? Math.min(...profits) : 0;
  const winSessions = profits.filter((p) => p > 0).length;
  const winRate = totalSessions > 0 ? Math.round((winSessions / totalSessions) * 100) : 0;

  // ─── Chart Data ───
  const chartData = settledEntries.reduce<{ label: string; cumulative: number }[]>(
    (acc, e) => {
      const net = Number(e.cash_out!) - Number(e.buy_in);
      const prev = acc.length > 0 ? acc[acc.length - 1].cumulative : 0;
      const d = new Date(e.sessions.created_at);
      acc.push({
        label: `${d.getMonth() + 1}/${d.getDate()}`,
        cumulative: prev + net,
      });
      return acc;
    },
    []
  );

  // ─── Monthly Summary ───
  const monthlySummary = settledEntries.reduce((acc, e) => {
    const d = new Date(e.sessions.created_at);
    const key = `${d.getFullYear()}年${d.getMonth() + 1}月`;
    if (!acc[key]) acc[key] = { profit: 0, sessions: 0 };
    acc[key].profit += Number(e.cash_out!) - Number(e.buy_in);
    acc[key].sessions += 1;
    return acc;
  }, {} as Record<string, { profit: number; sessions: number }>);

  const monthlyData = Object.entries(monthlySummary)
    .reverse()
    .map(([month, data]) => ({ month, ...data }));


  return (
    <div className="max-w-lg mx-auto p-4 pb-8">
      {/* Header */}
      <div className="flex items-center gap-3 py-4 mb-4">
        <button
          onClick={() => router.push('/')}
          className="text-gray-400 hover:text-white text-2xl"
        >
          ←
        </button>
        <h1 className="text-xl font-bold">{player.name} 的战绩</h1>
      </div>

      {/* Time Period Filter */}
      <div className="flex gap-2 mb-6">
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

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-gray-800 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold">{totalSessions}</div>
          <div className="text-xs text-gray-500 mt-1">总场次</div>
        </div>
        <div className="bg-gray-800 rounded-xl p-3 text-center">
          <div
            className={`text-2xl font-bold font-mono ${
              totalProfit > 0
                ? 'text-green-400'
                : totalProfit < 0
                ? 'text-red-400'
                : 'text-gray-400'
            }`}
          >
            {totalProfit > 0 ? '+' : ''}
            {totalProfit}
          </div>
          <div className="text-xs text-gray-500 mt-1">总盈亏</div>
        </div>
        <div className="bg-gray-800 rounded-xl p-3 text-center">
          <div
            className={`text-2xl font-bold font-mono ${
              avgProfit > 0
                ? 'text-green-400'
                : avgProfit < 0
                ? 'text-red-400'
                : 'text-gray-400'
            }`}
          >
            {avgProfit > 0 ? '+' : ''}
            {avgProfit}
          </div>
          <div className="text-xs text-gray-500 mt-1">场均</div>
        </div>
      </div>

      {/* Extra Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-gray-800 rounded-xl p-3 text-center">
          <div className="text-lg font-bold text-green-400 font-mono">
            +{maxWin}
          </div>
          <div className="text-xs text-gray-500 mt-1">最大赢</div>
        </div>
        <div className="bg-gray-800 rounded-xl p-3 text-center">
          <div className="text-lg font-bold text-red-400 font-mono">
            {maxLoss}
          </div>
          <div className="text-xs text-gray-500 mt-1">最大输</div>
        </div>
        <div className="bg-gray-800 rounded-xl p-3 text-center">
          <div className="text-lg font-bold">{winRate}%</div>
          <div className="text-xs text-gray-500 mt-1">胜率</div>
        </div>
      </div>

      {/* Cumulative Profit Line Chart */}
      <div className="bg-gray-800 rounded-xl p-4 mb-6">
        <h2 className="font-semibold mb-3 text-gray-300">累计盈亏曲线</h2>
        <ProfitChart data={chartData} />
      </div>

      {/* Per-Session Bar Chart */}
      {settledEntries.length > 0 && (
        <div className="bg-gray-800 rounded-xl p-4 mb-6">
          <h2 className="font-semibold mb-3 text-gray-300">每场盈亏</h2>
          <SessionChart
            data={settledEntries.map((e) => {
              const d = new Date(e.sessions.created_at);
              return {
                name: e.sessions.note || `${d.getMonth() + 1}/${d.getDate()}`,
                net: Number(e.cash_out!) - Number(e.buy_in),
              };
            })}
          />
        </div>
      )}

      {/* Monthly Summary */}
      {monthlyData.length > 1 && (
        <div className="bg-gray-800 rounded-xl p-4 mb-6">
          <h2 className="font-semibold mb-3 text-gray-300">月度汇总</h2>
          <div className="space-y-2">
            {monthlyData.map((m) => (
              <div
                key={m.month}
                className="flex items-center justify-between py-2 border-b border-gray-700 last:border-0"
              >
                <div>
                  <span className="text-gray-300">{m.month}</span>
                  <span className="text-gray-600 text-sm ml-2">{m.sessions}场</span>
                </div>
                <span
                  className={`font-mono font-bold ${
                    m.profit > 0
                      ? 'text-green-400'
                      : m.profit < 0
                      ? 'text-red-400'
                      : 'text-gray-400'
                  }`}
                >
                  {m.profit > 0 ? '+' : ''}
                  {Math.round(m.profit)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Session History */}
      <div>
        <h2 className="font-semibold mb-3 text-gray-300">历史记录</h2>
        {settledEntries.length === 0 ? (
          <p className="text-gray-500 text-center py-4">暂无已结算的记录</p>
        ) : (
          <div className="space-y-2">
            {[...settledEntries].reverse().map((e) => {
              const net = Number(e.cash_out!) - Number(e.buy_in);
              return (
                <button
                  key={e.id}
                  onClick={() => router.push(`/sessions/${e.sessions.id}`)}
                  className="w-full bg-gray-800 rounded-xl px-4 py-3 flex items-center justify-between text-left active:bg-gray-700 transition-colors"
                >
                  <div>
                    <span className="text-gray-300">
                      {e.sessions.note || formatDateShort(e.sessions.created_at)}
                    </span>
                    {e.sessions.note && (
                      <span className="text-gray-600 text-sm ml-2">
                        {formatDateShort(e.sessions.created_at)}
                      </span>
                    )}
                  </div>
                  <span
                    className={`font-mono font-bold ${
                      net > 0
                        ? 'text-green-400'
                        : net < 0
                        ? 'text-red-400'
                        : 'text-gray-400'
                    }`}
                  >
                    {net > 0 ? '+' : ''}
                    {net}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
