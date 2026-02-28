'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
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
} from '@/lib/settlement';
import { formatDateFull } from '@/lib/utils';
import { useDebounce } from '@/lib/useDebounce';
import { useToast } from '@/components/Toast';
import BottomSheet from '@/components/BottomSheet';
import ConfirmDialog from '@/components/ConfirmDialog';
import EntryCard from '@/components/EntryCard';
import SettlementResult from '@/components/SettlementResult';
import { SessionDetailSkeleton } from '@/components/Skeleton';
import { usePullToRefresh } from '@/lib/usePullToRefresh';
import PullIndicator from '@/components/PullIndicator';
import { hapticMedium, hapticSuccess, hapticHeavy } from '@/lib/haptic';

interface LocalEntry extends EntryWithPlayer {
  remaining: string;
}

export default function SessionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();

  const [session, setSession] = useState<Session | null>(null);
  const [entries, setEntries] = useState<LocalEntry[]>([]);
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [settlements, setSettlements] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [settling, setSettling] = useState(false);
  const [importing, setImporting] = useState(false);
  const [justSettled, setJustSettled] = useState(false);
  const settlementRef = useRef<HTMLDivElement>(null);

  // Edit note state
  const [editingNote, setEditingNote] = useState(false);
  const [noteValue, setNoteValue] = useState('');

  // Add player state
  const [showAdd, setShowAdd] = useState(false);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<Set<string>>(new Set());
  const [newPlayerName, setNewPlayerName] = useState('');
  const [addBuyIn, setAddBuyIn] = useState('400');

  // Confirmed entries
  const [confirmedIds, setConfirmedIds] = useState<Set<string>>(new Set());

  // Confirm dialog state
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ open: false, title: '', message: '', onConfirm: () => {} });

  const fetchData = useCallback(async () => {
    try {
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
            .select(
              '*, from_player:players!settlements_from_player_id_fkey(*), to_player:players!settlements_to_player_id_fkey(*)'
            )
            .eq('session_id', id),
        ]);

      if (sessionRes.error) throw sessionRes.error;
      if (entriesRes.error) throw entriesRes.error;

      setSession(sessionRes.data);
      setAllPlayers(playersRes.data ?? []);

      const mapped: LocalEntry[] = (entriesRes.data ?? []).map(
        (e: EntryWithPlayer) => ({
          ...e,
          remaining: e.cash_out != null ? String(e.cash_out) : '',
        })
      );
      setEntries(mapped);

      if (settlementsRes.data && settlementsRes.data.length > 0) {
        setSettlements(
          settlementsRes.data.map(
            (s: {
              from_player: Player;
              to_player: Player;
              amount: number;
            }) => ({
              from: s.from_player.name,
              fromId: s.from_player.id,
              to: s.to_player.name,
              toId: s.to_player.id,
              amount: Number(s.amount),
            })
          )
        );
      }
    } catch (err) {
      toast('加载数据失败: ' + (err instanceof Error ? err.message : '未知错误'));
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  const { refreshing, pullDistance } = usePullToRefresh(
    async () => { await fetchData(); }
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ─── Import Last Session Players ───
  async function handleImportLastSession() {
    setImporting(true);
    try {
      // Find the most recent OTHER session
      const { data: prevSessions, error: sessErr } = await supabase
        .from('sessions')
        .select('id')
        .neq('id', id)
        .order('created_at', { ascending: false })
        .limit(1);
      if (sessErr) throw sessErr;
      if (!prevSessions || prevSessions.length === 0) {
        toast('没有找到历史牌局', 'info');
        return;
      }
      const prevId = prevSessions[0].id;
      const { data: prevEntries, error: entErr } = await supabase
        .from('entries')
        .select('player_id, buy_in')
        .eq('session_id', prevId);
      if (entErr) throw entErr;
      if (!prevEntries || prevEntries.length === 0) {
        toast('上一场没有玩家', 'info');
        return;
      }
      // Filter out players already in this session
      const existingIds = new Set(entries.map((e) => e.player_id));
      const toAdd = prevEntries.filter((e) => !existingIds.has(e.player_id));
      if (toAdd.length === 0) {
        toast('上一场的玩家已全部添加', 'info');
        return;
      }
      const { error: insErr } = await supabase.from('entries').insert(
        toAdd.map((e) => ({
          session_id: id,
          player_id: e.player_id,
          buy_in: 400,
        }))
      );
      if (insErr) throw insErr;
      toast(`已导入 ${toAdd.length} 位玩家`, 'success');
      fetchData();
    } catch (err) {
      toast('导入失败: ' + (err instanceof Error ? err.message : ''));
    } finally {
      setImporting(false);
    }
  }

  // ─── Edit Note ───
  async function handleSaveNote() {
    const trimmed = noteValue.trim();
    try {
      const { error } = await supabase
        .from('sessions')
        .update({ note: trimmed || null })
        .eq('id', id);
      if (error) throw error;
      setSession((prev) =>
        prev ? { ...prev, note: trimmed || null } : prev
      );
    } catch (err) {
      toast('保存备注失败: ' + (err instanceof Error ? err.message : ''));
    }
    setEditingNote(false);
  }

  // ─── Add Player ───
  function togglePlayer(playerId: string) {
    setSelectedPlayerIds((prev) => {
      const next = new Set(prev);
      if (next.has(playerId)) next.delete(playerId);
      else next.add(playerId);
      return next;
    });
  }

  async function handleAddPlayers() {
    const buyIn = Number(addBuyIn) || 400;
    const playerIds = [...selectedPlayerIds];

    try {
      // Create new player if name is provided
      if (newPlayerName.trim()) {
        const { data, error } = await supabase
          .from('players')
          .upsert({ name: newPlayerName.trim() }, { onConflict: 'name' })
          .select()
          .single();
        if (error || !data) throw error ?? new Error('创建玩家失败');
        if (!playerIds.includes(data.id)) {
          playerIds.push(data.id);
        }
      }

      if (playerIds.length === 0) {
        toast('请选择或输入玩家', 'info');
        return;
      }

      // Filter out players already in session
      const existingIds = new Set(entries.map((e) => e.player_id));
      const toAdd = playerIds.filter((pid) => !existingIds.has(pid));
      if (toAdd.length === 0) {
        toast('选择的玩家都已在本场牌局中', 'info');
        return;
      }

      const { error } = await supabase.from('entries').insert(
        toAdd.map((pid) => ({
          session_id: id,
          player_id: pid,
          buy_in: buyIn,
        }))
      );
      if (error) throw error;

      setShowAdd(false);
      setSelectedPlayerIds(new Set());
      setNewPlayerName('');
      setAddBuyIn('400');
      fetchData();
    } catch (err) {
      toast('添加失败: ' + (err instanceof Error ? err.message : ''));
    }
  }

  // ─── Update Buy In (local) ───
  function handleBuyInChange(entryId: string, value: string) {
    setEntries((prev) =>
      prev.map((e) =>
        e.id === entryId ? { ...e, buy_in: Number(value) || 0 } : e
      )
    );
  }

  // ─── Save Buy In (debounced) ───
  const debouncedSaveBuyIn = useDebounce(
    async (entryId: string, value: number) => {
      try {
        const { error } = await supabase
          .from('entries')
          .update({ buy_in: value })
          .eq('id', entryId);
        if (error) throw error;
      } catch {
        toast('保存买入失败');
      }
    },
    600
  );

  // ─── Update Remaining ───
  function stripLeadingZeros(s: string): string {
    if (s === '' || s === '0') return s;
    const cleaned = s.replace(/^0+/, '');
    return cleaned === '' ? '0' : cleaned;
  }

  function handleRemainingChange(entryId: string, value: string) {
    const v = stripLeadingZeros(value);
    setEntries((prev) =>
      prev.map((e) => {
        if (e.id !== entryId) return e;
        return { ...e, remaining: v, cash_out: Number(v) || 0 };
      })
    );
  }

  const debouncedSaveCashOut = useDebounce(
    async (entryId: string, remaining: string) => {
      const cashOut = Number(remaining) || 0;
      try {
        const { error } = await supabase
          .from('entries')
          .update({ cash_out: cashOut })
          .eq('id', entryId);
        if (error) throw error;
      } catch {
        toast('保存结算失败');
      }
    },
    600
  );

  // ─── Confirm / Unconfirm ───
  function handleConfirmEntry(entryId: string) {
    // Save cash_out immediately on confirm (empty remaining = 0)
    const entry = entries.find((e) => e.id === entryId);
    if (entry) {
      const remaining = entry.remaining || '0';
      setEntries((prev) =>
        prev.map((e) =>
          e.id === entryId
            ? { ...e, remaining, cash_out: Number(remaining) || 0 }
            : e
        )
      );
      debouncedSaveCashOut(entryId, remaining);
    }
    setConfirmedIds((prev) => new Set(prev).add(entryId));
  }

  function handleUnconfirmEntry(entryId: string) {
    setConfirmedIds((prev) => {
      const next = new Set(prev);
      next.delete(entryId);
      return next;
    });
  }

  // ─── Remove Player ───
  function handleRemovePlayer(entryId: string) {
    setConfirmState({
      open: true,
      title: '移除玩家',
      message: '确认移除该玩家？',
      onConfirm: async () => {
        setConfirmState((prev) => ({ ...prev, open: false }));
        try {
          const { error } = await supabase
            .from('entries')
            .delete()
            .eq('id', entryId);
          if (error) throw error;
          fetchData();
        } catch {
          toast('移除失败');
        }
      },
    });
  }

  // ─── Settle ───
  async function handleSettle() {
    const withCashOut: EntryWithPlayer[] = entries.map((e) => ({
      ...e,
      cash_out: Number(e.remaining) || 0,
    }));

    const err = validateZeroSum(withCashOut);
    if (err) {
      toast('⚠️ ' + err, 'info');
      return;
    }

    setSettling(true);
    try {
      for (const e of withCashOut) {
        const { error: entryErr } = await supabase
          .from('entries')
          .update({ cash_out: e.cash_out })
          .eq('id', e.id);
        if (entryErr) throw entryErr;
      }

      const transfers = calculateSettlement(withCashOut);

      if (transfers.length > 0) {
        await supabase.from('settlements').delete().eq('session_id', id);
        const { error } = await supabase.from('settlements').insert(
          transfers.map((t) => ({
            session_id: id,
            from_player_id: t.fromId,
            to_player_id: t.toId,
            amount: t.amount,
          }))
        );
        if (error) throw error;
      }

      await supabase
        .from('sessions')
        .update({ status: 'settled' })
        .eq('id', id);

      setSettlements(transfers);
      setSession((prev) =>
        prev ? { ...prev, status: 'settled' } : prev
      );
      setJustSettled(true);
      hapticSuccess();
      toast('结算完成！', 'success');
      // Scroll to settlement result
      setTimeout(() => {
        settlementRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);
    } catch (err) {
      toast(
        '结算失败: ' + (err instanceof Error ? err.message : '未知错误')
      );
    } finally {
      setSettling(false);
    }
  }

  // ─── Reopen ───
  async function handleReopen() {
    try {
      await supabase
        .from('sessions')
        .update({ status: 'open' })
        .eq('id', id);
      await supabase.from('settlements').delete().eq('session_id', id);
      setSession((prev) =>
        prev ? { ...prev, status: 'open' } : prev
      );
      setSettlements([]);
    } catch {
      toast('重新打开失败');
    }
  }

  // ─── Delete Session ───
  function handleDelete() {
    setConfirmState({
      open: true,
      title: '删除牌局',
      message: '确认删除这场牌局？所有记录和结算单都会被删除。',
      onConfirm: async () => {
        setConfirmState((prev) => ({ ...prev, open: false }));
        try {
          const { error } = await supabase
            .from('sessions')
            .delete()
            .eq('id', id);
          if (error) throw error;
          router.push('/');
        } catch (err) {
          toast(
            '删除失败: ' +
              (err instanceof Error ? err.message : '未知错误')
          );
        }
      },
    });
  }

  // ─── Computed Values ───
  const totalBuyIn = entries.reduce((s, e) => s + Number(e.buy_in), 0);
  const totalCashOut = entries.reduce(
    (s, e) => s + (Number(e.remaining) || 0),
    0
  );
  const diff = totalBuyIn - totalCashOut;
  const isBalanced = Math.abs(diff) < 0.01;
  const allConfirmed =
    entries.length > 0 && entries.every((e) => confirmedIds.has(e.id));
  const isOpen = session?.status === 'open';

  const availablePlayers = allPlayers.filter(
    (p) => !entries.some((e) => e.player_id === p.id)
  );

  if (loading) {
    return <SessionDetailSkeleton />;
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
      {/* Pull to refresh */}
      <PullIndicator pullDistance={pullDistance} refreshing={refreshing} />

      {/* Header */}
      <div className="flex items-center gap-3 py-4 mb-2">
        <button
          onClick={() => router.push('/')}
          className="text-gray-400 hover:text-white text-2xl"
        >
          ←
        </button>
        <div className="flex-1">
          {editingNote ? (
            <input
              type="text"
              value={noteValue}
              onChange={(e) => setNoteValue(e.target.value)}
              onBlur={handleSaveNote}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveNote();
                if (e.key === 'Escape') setEditingNote(false);
              }}
              autoFocus
              placeholder="牌局备注"
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-2 py-1 text-xl font-bold focus:outline-none focus:border-green-500"
            />
          ) : (
            <h1
              className="text-xl font-bold cursor-pointer hover:text-green-400 transition-colors"
              onClick={() => {
                setNoteValue(session.note || '');
                setEditingNote(true);
              }}
              title="点击编辑备注"
            >
              {session.note || '牌局详情'}
              <span className="text-gray-600 text-sm ml-1">✏️</span>
            </h1>
          )}
          <p className="text-sm text-gray-500">
            {formatDateFull(session.created_at)}
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

      {/* Field explanation */}
      {isOpen && entries.length > 0 && (
        <p className="text-xs text-gray-600 mb-3">
          买入 = 总共带入的筹码 · 剩余筹码 = 结束时手上的筹码 · 每个筹码 = ¥0.25
        </p>
      )}

      {/* Player Entries */}
      <div className="space-y-3 mb-4">
        {entries.map((entry) => (
          <EntryCard
            key={entry.id}
            entry={entry}
            isOpen={isOpen}
            confirmed={confirmedIds.has(entry.id)}
            onBuyInChange={handleBuyInChange}
            onBuyInSave={debouncedSaveBuyIn}
            onRemainingChange={handleRemainingChange}
            onCashOutSave={debouncedSaveCashOut}
            onConfirm={handleConfirmEntry}
            onUnconfirm={handleUnconfirmEntry}
            onRemove={handleRemovePlayer}
          />
        ))}
      </div>

      {/* Add Player Buttons */}
      {isOpen && (
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => { hapticMedium(); setShowAdd(true); }}
            className="flex-1 border-2 border-dashed border-gray-700 hover:border-gray-500 rounded-xl py-3 text-gray-400 hover:text-gray-200 transition-colors press-effect"
          >
            + 添加玩家
          </button>
          <button
            onClick={() => { hapticMedium(); handleImportLastSession(); }}
            disabled={importing}
            className="border-2 border-dashed border-gray-700 hover:border-green-600 rounded-xl px-4 py-3 text-gray-400 hover:text-green-400 transition-colors disabled:text-gray-600 press-effect"
          >
            {importing ? '导入中...' : '⏪ 上一场'}
          </button>
        </div>
      )}

      {/* Add Player Bottom Sheet */}
      <BottomSheet
        open={showAdd}
        onClose={() => setShowAdd(false)}
        title="添加玩家"
      >
        <div className="space-y-4">
          {availablePlayers.length > 0 && (
            <div>
              <label className="text-sm text-gray-400 block mb-2">
                选择玩家（可多选）
              </label>
              <div className="flex flex-wrap gap-2">
                {availablePlayers.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => togglePlayer(p.id)}
                    className={`px-3 py-2 rounded-lg text-sm transition-colors press-effect ${
                      selectedPlayerIds.has(p.id)
                        ? 'bg-green-600 text-white border border-green-500'
                        : 'bg-gray-700 text-gray-300 border border-gray-600 hover:bg-gray-600'
                    }`}
                  >
                    {selectedPlayerIds.has(p.id) ? '✓ ' : ''}{p.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 text-sm text-gray-500">
            <div className="flex-1 h-px bg-gray-700" />
            <span>新玩家</span>
            <div className="flex-1 h-px bg-gray-700" />
          </div>

          <input
            type="text"
            value={newPlayerName}
            onChange={(e) => setNewPlayerName(e.target.value)}
            placeholder="输入新玩家名字"
            className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-3 focus:outline-none focus:border-green-500"
          />

          <div>
            <label className="text-sm text-gray-400 block mb-2">
              买入筹码
            </label>
            <input
              type="number"
              inputMode="numeric"
              pattern="[0-9]*"
              value={addBuyIn}
              onChange={(e) => setAddBuyIn(stripLeadingZeros(e.target.value))}
              className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-3 text-center text-lg focus:outline-none focus:border-green-500"
            />
          </div>

          <button
            onClick={handleAddPlayers}
            disabled={selectedPlayerIds.size === 0 && !newPlayerName.trim()}
            className="w-full bg-green-600 hover:bg-green-700 active:bg-green-800 disabled:bg-gray-700 disabled:text-gray-500 rounded-xl py-4 text-lg font-medium transition-colors"
          >
            确认添加{selectedPlayerIds.size + (newPlayerName.trim() ? 1 : 0) > 0
              ? ` (${selectedPlayerIds.size + (newPlayerName.trim() ? 1 : 0)}人)`
              : ''}
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
                isBalanced ? 'text-green-400' : 'text-red-400'
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
          onClick={() => { hapticHeavy(); handleSettle(); }}
          disabled={!allConfirmed || !isBalanced || settling}
          className="w-full bg-green-600 hover:bg-green-700 active:bg-green-800 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-xl py-4 text-lg font-medium transition-colors mb-6 press-effect"
        >
          {settling
            ? '结算中...'
            : !allConfirmed
            ? '请所有玩家确认'
            : !isBalanced
            ? '总数不平衡，无法结算'
            : '💰 结算'}
        </button>
      )}

      {/* Settlement Results */}
      <div className={justSettled ? 'animate-success-pop' : ''}>
        <SettlementResult
          ref={settlementRef}
          settlements={settlements}
          sessionNote={session.note}
          entries={!isOpen ? entries.map((e) => ({
            name: e.players.name,
            buyIn: Number(e.buy_in),
            cashOut: Number(e.cash_out ?? 0),
          })) : undefined}
        />
      </div>

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
