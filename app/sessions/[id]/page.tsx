'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  Session,
  Player,
  EntryWithPlayer,
  Transfer,
} from '@/lib/types';
import {
  validateZeroSum,
  calculateSettlement,
  formatSettlementText,
} from '@/lib/settlement';
import BottomSheet from '@/components/BottomSheet';

interface LocalEntry extends EntryWithPlayer {
  remaining: string; // 剩余筹码 input
  early: string;     // 已提前兑出 input
}

export default function SessionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [session, setSession] = useState<Session | null>(null);
  const [entries, setEntries] = useState<LocalEntry[]>([]);
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [settlements, setSettlements] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [settling, setSettling] = useState(false);
  const [copied, setCopied] = useState(false);

  // Add player state
  const [showAdd, setShowAdd] = useState(false);
  const [addPlayerId, setAddPlayerId] = useState('');
  const [newPlayerName, setNewPlayerName] = useState('');
  const [addBuyIn, setAddBuyIn] = useState('400');

  const fetchData = useCallback(async () => {
    const [sessionRes, entriesRes, playersRes, settlementsRes] =
      await Promise.all([
        supabase.from('sessions').select('*').eq('id', id).single(),
        supabase
          .from('entries')
          .select('*, players(*)')
          .eq('session_id', id)
          .order('created_at'),
        supabase.from('players').select('*').order('name'),
        supabase
          .from('settlements')
          .select('*, from_player:players!settlements_from_player_id_fkey(*), to_player:players!settlements_to_player_id_fkey(*)')
          .eq('session_id', id),
      ]);

    setSession(sessionRes.data);
    setAllPlayers(playersRes.data ?? []);

    // Map entries to local state with remaining/early fields
    const mapped: LocalEntry[] = (entriesRes.data ?? []).map((e: EntryWithPlayer) => ({
      ...e,
      remaining: e.cash_out != null ? String(e.cash_out) : '',
      early: '0',
    }));
    setEntries(mapped);

    // Map settlements
    if (settlementsRes.data && settlementsRes.data.length > 0) {
      setSettlements(
        settlementsRes.data.map((s: { from_player: Player; to_player: Player; amount: number }) => ({
          from: s.from_player.name,
          fromId: s.from_player.id,
          to: s.to_player.name,
          toId: s.to_player.id,
          amount: Number(s.amount),
        }))
      );
    }

    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ─── Add Player ───
  async function handleAddPlayer() {
    let playerId = addPlayerId;

    // Create new player if needed
    if (!playerId && newPlayerName.trim()) {
      const { data, error } = await supabase
        .from('players')
        .upsert({ name: newPlayerName.trim() }, { onConflict: 'name' })
        .select()
        .single();
      if (error || !data) {
        alert('添加玩家失败: ' + (error?.message ?? ''));
        return;
      }
      playerId = data.id;
    }

    if (!playerId) {
      alert('请选择或输入玩家名');
      return;
    }

    // Check duplicate
    if (entries.some((e) => e.player_id === playerId)) {
      alert('该玩家已在本场牌局中');
      return;
    }

    const { error } = await supabase.from('entries').insert({
      session_id: id,
      player_id: playerId,
      buy_in: Number(addBuyIn) || 400,
    });

    if (error) {
      alert('添加失败: ' + error.message);
      return;
    }

    // Reset & refresh
    setShowAdd(false);
    setAddPlayerId('');
    setNewPlayerName('');
    setAddBuyIn('400');
    fetchData();
  }

  // ─── Update Buy In ───
  async function handleBuyInChange(entryId: string, value: string) {
    setEntries((prev) =>
      prev.map((e) =>
        e.id === entryId ? { ...e, buy_in: Number(value) || 0 } : e
      )
    );
  }

  async function saveBuyIn(entryId: string, value: number) {
    await supabase
      .from('entries')
      .update({ buy_in: value })
      .eq('id', entryId);
  }

  // ─── Update Remaining / Early ───
  function handleRemainingChange(entryId: string, value: string) {
    setEntries((prev) =>
      prev.map((e) => {
        if (e.id !== entryId) return e;
        const remaining = value;
        const cashOut =
          (Number(remaining) || 0) + (Number(e.early) || 0);
        return { ...e, remaining, cash_out: cashOut };
      })
    );
  }

  function handleEarlyChange(entryId: string, value: string) {
    setEntries((prev) =>
      prev.map((e) => {
        if (e.id !== entryId) return e;
        const early = value;
        const cashOut =
          (Number(e.remaining) || 0) + (Number(early) || 0);
        return { ...e, early, cash_out: cashOut };
      })
    );
  }

  async function saveCashOut(entryId: string, remaining: string, early: string) {
    const cashOut = (Number(remaining) || 0) + (Number(early) || 0);
    if (remaining === '' && early === '0') return; // nothing to save
    await supabase
      .from('entries')
      .update({ cash_out: cashOut })
      .eq('id', entryId);
  }

  // ─── Remove Player ───
  async function handleRemovePlayer(entryId: string) {
    if (!confirm('确认移除该玩家？')) return;
    await supabase.from('entries').delete().eq('id', entryId);
    fetchData();
  }

  // ─── Settle ───
  async function handleSettle() {
    // Check all players have cash_out
    const incomplete = entries.filter(
      (e) => e.remaining === '' && e.cash_out == null
    );
    if (incomplete.length > 0) {
      alert(
        `以下玩家还没填结算：${incomplete.map((e) => e.players.name).join('、')}`
      );
      return;
    }

    // Build entries with computed cash_out for validation
    const withCashOut: EntryWithPlayer[] = entries.map((e) => ({
      ...e,
      cash_out: (Number(e.remaining) || 0) + (Number(e.early) || 0),
    }));

    // Zero-sum validation
    const err = validateZeroSum(withCashOut);
    if (err) {
      alert('⚠️ ' + err);
      return;
    }

    setSettling(true);

    // Save all cash_out values
    for (const e of withCashOut) {
      await supabase
        .from('entries')
        .update({ cash_out: e.cash_out })
        .eq('id', e.id);
    }

    // Calculate settlement
    const transfers = calculateSettlement(withCashOut);

    // Save settlements
    if (transfers.length > 0) {
      // Clear old settlements first
      await supabase.from('settlements').delete().eq('session_id', id);

      await supabase.from('settlements').insert(
        transfers.map((t) => ({
          session_id: id,
          from_player_id: t.fromId,
          to_player_id: t.toId,
          amount: t.amount,
        }))
      );
    }

    // Mark session as settled
    await supabase
      .from('sessions')
      .update({ status: 'settled' })
      .eq('id', id);

    setSettlements(transfers);
    setSession((prev) => (prev ? { ...prev, status: 'settled' } : prev));
    setSettling(false);
  }

  // ─── Reopen ───
  async function handleReopen() {
    await supabase
      .from('sessions')
      .update({ status: 'open' })
      .eq('id', id);
    await supabase.from('settlements').delete().eq('session_id', id);
    setSession((prev) => (prev ? { ...prev, status: 'open' } : prev));
    setSettlements([]);
  }

  // ─── Delete Session ───
  async function handleDelete() {
    if (!confirm('确认删除这场牌局？\n所有记录和结算单都会被删除。')) return;
    const { error } = await supabase.from('sessions').delete().eq('id', id);
    if (error) {
      alert('删除失败: ' + error.message);
      return;
    }
    router.push('/');
  }

  // ─── Copy Settlement ───
  function handleCopy() {
    const text = formatSettlementText(settlements, session?.note);
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // ─── Computed Values ───
  const totalBuyIn = entries.reduce((s, e) => s + Number(e.buy_in), 0);
  const totalCashOut = entries.reduce(
    (s, e) => s + (Number(e.remaining) || 0) + (Number(e.early) || 0),
    0
  );
  const diff = totalBuyIn - totalCashOut;
  const isBalanced = Math.abs(diff) < 0.01;
  const allFilled = entries.length > 0 && entries.every((e) => e.remaining !== '');
  const isOpen = session?.status === 'open';

  // ─── Helpers ───
  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      weekday: 'short',
      hour: 'numeric',
      minute: 'numeric',
    });
  }

  // Players not already in the session
  const availablePlayers = allPlayers.filter(
    (p) => !entries.some((e) => e.player_id === p.id)
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-400">加载中...</div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="max-w-lg mx-auto p-4 pt-8 text-center text-gray-400">
        牌局不存在
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto p-4 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 py-4 mb-2">
        <button
          onClick={() => router.push('/')}
          className="text-gray-400 hover:text-white text-2xl"
        >
          ←
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">
            {session.note || '牌局详情'}
          </h1>
          <p className="text-sm text-gray-500">
            {formatDate(session.created_at)}
          </p>
        </div>
        <span
          className={`text-xs px-2 py-1 rounded-full ${
            isOpen
              ? 'bg-yellow-900/50 text-yellow-400'
              : 'bg-green-900/50 text-green-400'
          }`}
        >
          {isOpen ? '进行中' : '已结算'}
        </span>
      </div>

      {/* Player Entries */}
      <div className="space-y-3 mb-4">
        {entries.map((entry) => {
          const net =
            entry.cash_out != null
              ? Number(entry.cash_out) - Number(entry.buy_in)
              : null;

          return (
            <div
              key={entry.id}
              className="bg-gray-800 rounded-xl p-4"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="font-semibold text-lg">
                  {entry.players.name}
                </span>
                {net != null && (
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
                )}
                {isOpen && (
                  <button
                    onClick={() => handleRemovePlayer(entry.id)}
                    className="text-gray-600 hover:text-red-400 text-sm ml-2"
                  >
                    ✕
                  </button>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3 text-sm">
                {/* Buy In */}
                <div>
                  <label className="text-gray-500 block mb-1">
                    买入
                  </label>
                  {isOpen ? (
                    <input
                      type="number"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={entry.buy_in}
                      onChange={(e) =>
                        handleBuyInChange(entry.id, e.target.value)
                      }
                      onBlur={(e) =>
                        saveBuyIn(entry.id, Number(e.target.value) || 0)
                      }
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-center focus:outline-none focus:border-green-500"
                    />
                  ) : (
                    <div className="text-center py-2 font-mono">
                      {entry.buy_in}
                    </div>
                  )}
                </div>

                {/* Remaining chips */}
                <div>
                  <label className="text-gray-500 block mb-1">
                    剩余筹码
                  </label>
                  {isOpen ? (
                    <input
                      type="number"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={entry.remaining}
                      onChange={(e) =>
                        handleRemainingChange(entry.id, e.target.value)
                      }
                      onBlur={() =>
                        saveCashOut(entry.id, entry.remaining, entry.early)
                      }
                      placeholder="0"
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-center focus:outline-none focus:border-green-500"
                    />
                  ) : (
                    <div className="text-center py-2 font-mono">
                      {entry.remaining || entry.cash_out || 0}
                    </div>
                  )}
                </div>

                {/* Early cashout */}
                <div>
                  <label className="text-gray-500 block mb-1">
                    已兑出
                  </label>
                  {isOpen ? (
                    <input
                      type="number"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={entry.early}
                      onChange={(e) =>
                        handleEarlyChange(entry.id, e.target.value)
                      }
                      onBlur={() =>
                        saveCashOut(entry.id, entry.remaining, entry.early)
                      }
                      placeholder="0"
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-center focus:outline-none focus:border-green-500"
                    />
                  ) : (
                    <div className="text-center py-2 font-mono">
                      {entry.early || 0}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Player Button */}
      {isOpen && (
        <button
          onClick={() => setShowAdd(true)}
          className="w-full border-2 border-dashed border-gray-700 hover:border-gray-500 rounded-xl py-3 text-gray-400 hover:text-gray-200 transition-colors mb-6"
        >
          + 添加玩家
        </button>
      )}

      {/* Add Player Bottom Sheet */}
      <BottomSheet
        open={showAdd}
        onClose={() => setShowAdd(false)}
        title="添加玩家"
      >
        <div className="space-y-4">
          <div>
            <label className="text-sm text-gray-400 block mb-2">选择已有玩家</label>
            <select
              value={addPlayerId}
              onChange={(e) => {
                setAddPlayerId(e.target.value);
                setNewPlayerName('');
              }}
              className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-3 focus:outline-none focus:border-green-500"
            >
              <option value="">选择玩家...</option>
              {availablePlayers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 text-sm text-gray-500">
            <div className="flex-1 h-px bg-gray-700" />
            <span>或输入新玩家</span>
            <div className="flex-1 h-px bg-gray-700" />
          </div>

          <input
            type="text"
            value={newPlayerName}
            onChange={(e) => {
              setNewPlayerName(e.target.value);
              setAddPlayerId('');
            }}
            placeholder="新玩家名字"
            className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-3 focus:outline-none focus:border-green-500"
          />

          <div>
            <label className="text-sm text-gray-400 block mb-2">买入金额</label>
            <input
              type="number"
              inputMode="numeric"
              pattern="[0-9]*"
              value={addBuyIn}
              onChange={(e) => setAddBuyIn(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-3 text-center text-lg focus:outline-none focus:border-green-500"
            />
          </div>

          <button
            onClick={handleAddPlayer}
            className="w-full bg-green-600 hover:bg-green-700 active:bg-green-800 rounded-xl py-4 text-lg font-medium transition-colors"
          >
            确认添加
          </button>
        </div>
      </BottomSheet>

      {/* Totals */}
      {entries.length > 0 && (
        <div className="bg-gray-800/50 rounded-xl p-4 mb-6">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-400">总买入</span>
            <span className="font-mono">{totalBuyIn}</span>
          </div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-400">总结算</span>
            <span className="font-mono">{totalCashOut}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">差额</span>
            <span
              className={`font-mono font-bold ${
                isBalanced
                  ? 'text-green-400'
                  : 'text-red-400'
              }`}
            >
              {isBalanced ? '✓ 平衡' : diff}
            </span>
          </div>
        </div>
      )}

      {/* Settle Button */}
      {isOpen && entries.length >= 2 && (
        <button
          onClick={handleSettle}
          disabled={!allFilled || !isBalanced || settling}
          className="w-full bg-green-600 hover:bg-green-700 active:bg-green-800 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-xl py-4 text-lg font-medium transition-colors mb-6"
        >
          {settling
            ? '结算中...'
            : !allFilled
            ? '请填写所有玩家的结算'
            : !isBalanced
            ? '总数不平衡，无法结算'
            : '💰 结算'}
        </button>
      )}

      {/* Settlement Results */}
      {settlements.length > 0 && (
        <div className="bg-gray-800 rounded-xl p-4 mb-6">
          <h2 className="font-semibold mb-3 text-green-400">
            💰 结算单
          </h2>
          <div className="space-y-2">
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

          <button
            onClick={handleCopy}
            className="w-full mt-4 bg-gray-700 hover:bg-gray-600 rounded-lg py-2 text-sm transition-colors"
          >
            {copied ? '✓ 已复制' : '📋 复制结算单'}
          </button>
        </div>
      )}

      {/* Reopen */}
      {!isOpen && (
        <button
          onClick={handleReopen}
          className="w-full bg-gray-800 hover:bg-gray-700 text-gray-400 rounded-xl py-3 text-sm transition-colors"
        >
          重新打开牌局
        </button>
      )}

      {/* Delete Session */}
      <button
        onClick={handleDelete}
        className="w-full mt-4 text-gray-600 hover:text-red-400 py-3 text-sm transition-colors"
      >
        删除牌局
      </button>
    </div>
  );
}
