'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Player, Session } from '@/lib/types';
import { formatDateShort } from '@/lib/utils';
import { useToast } from '@/components/Toast';
import BottomSheet from '@/components/BottomSheet';
import ConfirmDialog from '@/components/ConfirmDialog';

const PAGE_SIZE = 20;

export default function HomePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [players, setPlayers] = useState<Player[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showManage, setShowManage] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  // Confirm dialog
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ open: false, title: '', message: '', onConfirm: () => {} });

  useEffect(() => {
    const saved = localStorage.getItem('poker-player-id');
    if (saved) setSelectedPlayerId(saved);
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchData() {
    try {
      const [playersRes, sessionsRes] = await Promise.all([
        supabase.from('players').select('*').order('name'),
        supabase
          .from('sessions')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(PAGE_SIZE + 1),
      ]);
      if (playersRes.error) throw playersRes.error;
      if (sessionsRes.error) throw sessionsRes.error;
      const data = sessionsRes.data ?? [];
      setHasMore(data.length > PAGE_SIZE);
      setPlayers(playersRes.data ?? []);
      setSessions(data.slice(0, PAGE_SIZE));
    } catch (err) {
      toast('加载失败: ' + (err instanceof Error ? err.message : '未知错误'));
    } finally {
      setLoading(false);
    }
  }

  async function loadMore() {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    try {
      const last = sessions[sessions.length - 1];
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .order('created_at', { ascending: false })
        .lt('created_at', last.created_at)
        .limit(PAGE_SIZE + 1);
      if (error) throw error;
      const rows = data ?? [];
      setHasMore(rows.length > PAGE_SIZE);
      setSessions((prev) => [...prev, ...rows.slice(0, PAGE_SIZE)]);
    } catch {
      toast('加载更多失败');
    } finally {
      setLoadingMore(false);
    }
  }

  function handlePlayerChange(id: string) {
    setSelectedPlayerId(id);
    localStorage.setItem('poker-player-id', id);
  }

  function handleDeletePlayer(player: Player) {
    setConfirmState({
      open: true,
      title: '删除玩家',
      message: `确认删除玩家「${player.name}」？该玩家的所有历史记录也会被删除。`,
      onConfirm: async () => {
        setConfirmState((prev) => ({ ...prev, open: false }));
        try {
          const { error } = await supabase
            .from('players')
            .delete()
            .eq('id', player.id);
          if (error) throw error;
          if (selectedPlayerId === player.id) {
            setSelectedPlayerId('');
            localStorage.removeItem('poker-player-id');
          }
          fetchData();
        } catch (err) {
          toast('删除失败: ' + (err instanceof Error ? err.message : ''));
        }
      },
    });
  }

  async function handleRenamePlayer(player: Player) {
    const trimmed = editName.trim();
    if (!trimmed || trimmed === player.name) {
      setEditingPlayer(null);
      return;
    }
    try {
      const { error } = await supabase
        .from('players')
        .update({ name: trimmed })
        .eq('id', player.id);
      if (error) throw error;
      setEditingPlayer(null);
      fetchData();
    } catch (err) {
      toast('改名失败: ' + (err instanceof Error ? err.message : ''));
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-400">加载中...</div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto p-4 pb-8">
      {/* Header */}
      <div className="text-center pt-6 pb-8">
        <h1 className="text-3xl font-bold">🃏 德扑记账</h1>
        <p className="text-gray-400 mt-1 text-sm">朋友局记账工具</p>
      </div>

      {/* Player Select */}
      <div className="mb-8">
        <label className="block text-sm text-gray-400 mb-2">我是谁</label>
        <div className="flex gap-2">
          <select
            className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-lg focus:outline-none focus:border-green-500 appearance-none"
            value={selectedPlayerId}
            onChange={(e) => handlePlayerChange(e.target.value)}
          >
            <option value="">选择玩家...</option>
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          {players.length > 0 && (
            <button
              onClick={() => setShowManage(true)}
              className="bg-gray-800 border border-gray-700 rounded-xl px-3 text-gray-400 hover:text-white transition-colors"
              title="管理玩家"
            >
              ⚙️
            </button>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <button
          onClick={() => router.push('/sessions/new')}
          className="bg-green-600 hover:bg-green-700 active:bg-green-800 text-white rounded-xl py-4 text-lg font-medium transition-colors"
        >
          + 新增牌局
        </button>
        <button
          onClick={() => {
            if (selectedPlayerId) {
              router.push(`/stats/${selectedPlayerId}`);
            } else {
              toast('请先选择你是谁', 'info');
            }
          }}
          className="bg-gray-700 hover:bg-gray-600 active:bg-gray-500 text-white rounded-xl py-4 text-lg font-medium transition-colors"
        >
          📊 我的战绩
        </button>
      </div>

      {/* Unsettled Sessions */}
      {sessions.filter((s) => s.status === 'open').length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-3 text-yellow-400">⚠️ 未结算</h2>
          <div className="space-y-2">
            {sessions
              .filter((s) => s.status === 'open')
              .map((s) => (
                <button
                  key={s.id}
                  onClick={() => router.push(`/sessions/${s.id}`)}
                  className="w-full bg-yellow-900/20 border border-yellow-800/50 hover:bg-yellow-900/30 rounded-xl px-4 py-3 flex items-center justify-between text-left transition-colors active:bg-yellow-900/40"
                >
                  <div>
                    <span className="text-gray-200">
                      {s.note || formatDateShort(s.created_at)}
                    </span>
                    {s.note && (
                      <span className="text-gray-500 text-sm ml-2">
                        {formatDateShort(s.created_at)}
                      </span>
                    )}
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full bg-yellow-900/50 text-yellow-400">
                    进行中
                  </span>
                </button>
              ))}
          </div>
        </div>
      )}

      {/* Settled Sessions */}
      <div>
        <h2 className="text-lg font-semibold mb-3 text-gray-300">历史牌局</h2>
        {sessions.filter((s) => s.status === 'settled').length === 0 ? (
          <p className="text-gray-500 text-center py-8">还没有已结算的牌局</p>
        ) : (
          <div className="space-y-2">
            {sessions
              .filter((s) => s.status === 'settled')
              .map((s) => (
                <button
                  key={s.id}
                  onClick={() => router.push(`/sessions/${s.id}`)}
                  className="w-full bg-gray-800 hover:bg-gray-750 rounded-xl px-4 py-3 flex items-center justify-between text-left transition-colors active:bg-gray-700"
                >
                  <div>
                    <span className="text-gray-200">
                      {s.note || formatDateShort(s.created_at)}
                    </span>
                    {s.note && (
                      <span className="text-gray-500 text-sm ml-2">
                        {formatDateShort(s.created_at)}
                      </span>
                    )}
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full bg-green-900/50 text-green-400">
                    已结算
                  </span>
                </button>
              ))}
          </div>
        )}

        {/* Load More */}
        {hasMore && (
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="w-full mt-4 text-gray-500 hover:text-gray-300 py-3 text-sm transition-colors disabled:text-gray-700"
          >
            {loadingMore ? '加载中...' : '加载更多'}
          </button>
        )}
      </div>
      {/* Manage Players Bottom Sheet */}
      <BottomSheet
        open={showManage}
        onClose={() => setShowManage(false)}
        title="管理玩家"
      >
        <div className="space-y-2">
          {players.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between bg-gray-700 rounded-xl px-4 py-3"
            >
              {editingPlayer === p.id ? (
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={() => handleRenamePlayer(p)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRenamePlayer(p);
                    if (e.key === 'Escape') setEditingPlayer(null);
                  }}
                  autoFocus
                  className="flex-1 bg-gray-600 border border-gray-500 rounded-lg px-2 py-1 mr-2 focus:outline-none focus:border-green-500"
                />
              ) : (
                <span
                  onClick={() => {
                    setEditingPlayer(p.id);
                    setEditName(p.name);
                  }}
                  className="cursor-pointer hover:text-green-400 transition-colors"
                  title="点击改名"
                >
                  {p.name}
                </span>
              )}
              <button
                onClick={() => handleDeletePlayer(p)}
                className="text-gray-500 hover:text-red-400 text-sm transition-colors ml-2"
              >
                删除
              </button>
            </div>
          ))}
          {players.length === 0 && (
            <p className="text-gray-500 text-center py-4">还没有玩家</p>
          )}
        </div>
      </BottomSheet>

      {/* Confirm Dialog */}
      <ConfirmDialog
        open={confirmState.open}
        onConfirm={confirmState.onConfirm}
        onCancel={() =>
          setConfirmState((prev) => ({ ...prev, open: false }))
        }
        title={confirmState.title}
        message={confirmState.message}
      />
    </div>
  );
}
