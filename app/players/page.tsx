'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Player } from '@/lib/types';
import { useToast } from '@/components/Toast';
import ConfirmDialog from '@/components/ConfirmDialog';

export default function PlayersPage() {
  const { toast } = useToast();
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ open: false, title: '', message: '', onConfirm: () => {} });

  useEffect(() => {
    fetchPlayers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchPlayers() {
    try {
      const { data, error } = await supabase.from('players').select('*').order('name');
      if (error) throw error;
      setPlayers(data ?? []);
    } catch (err) {
      toast('加载失败: ' + (err instanceof Error ? err.message : ''));
    } finally {
      setLoading(false);
    }
  }

  async function handleRename(player: Player) {
    const trimmed = editName.trim();
    if (!trimmed || trimmed === player.name) {
      setEditingId(null);
      return;
    }
    try {
      const { error } = await supabase
        .from('players')
        .update({ name: trimmed })
        .eq('id', player.id);
      if (error) throw error;
      setEditingId(null);
      fetchPlayers();
    } catch (err) {
      toast('改名失败: ' + (err instanceof Error ? err.message : ''));
    }
  }

  function handleDelete(player: Player) {
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
          const saved = localStorage.getItem('poker-player-id');
          if (saved === player.id) {
            localStorage.removeItem('poker-player-id');
          }
          fetchPlayers();
        } catch (err) {
          toast('删除失败: ' + (err instanceof Error ? err.message : ''));
        }
      },
    });
  }

  async function handleAdd() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setAdding(true);
    try {
      const { error } = await supabase
        .from('players')
        .upsert({ name: trimmed }, { onConflict: 'name' });
      if (error) throw error;
      setNewName('');
      fetchPlayers();
    } catch (err) {
      toast('添加失败: ' + (err instanceof Error ? err.message : ''));
    } finally {
      setAdding(false);
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
      <div className="text-center pt-6 pb-6">
        <h1 className="text-2xl font-bold">👤 用户管理</h1>
      </div>

      {/* Add Player */}
      <div className="flex gap-2 mb-6">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="输入新玩家名字"
          className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 focus:outline-none focus:border-green-500"
        />
        <button
          onClick={handleAdd}
          disabled={adding || !newName.trim()}
          className="bg-green-600 hover:bg-green-700 active:bg-green-800 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-xl px-5 font-medium transition-colors"
        >
          添加
        </button>
      </div>

      {/* Player List */}
      {players.length === 0 ? (
        <p className="text-gray-500 text-center py-8">还没有玩家</p>
      ) : (
        <div className="space-y-3">
          {players.map((p) => (
            <div
              key={p.id}
              className="bg-gray-800 rounded-xl p-4 flex items-center gap-3"
            >
              {editingId === p.id ? (
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={() => handleRename(p)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRename(p);
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                  autoFocus
                  className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:border-green-500"
                />
              ) : (
                <span className="flex-1 text-lg">{p.name}</span>
              )}

              {editingId !== p.id && (
                <button
                  onClick={() => {
                    setEditingId(p.id);
                    setEditName(p.name);
                  }}
                  className="text-gray-500 hover:text-green-400 transition-colors px-2 py-1 text-sm"
                >
                  改名
                </button>
              )}
              <button
                onClick={() => handleDelete(p)}
                className="text-gray-500 hover:text-red-400 transition-colors px-2 py-1 text-sm"
              >
                删除
              </button>
            </div>
          ))}
        </div>
      )}

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
