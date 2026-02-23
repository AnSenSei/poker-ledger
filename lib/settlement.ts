import { EntryWithPlayer, Transfer } from './types';

/**
 * 零和校验：总买入必须等于总结算
 */
export function validateZeroSum(entries: EntryWithPlayer[]): string | null {
  const totalBuyIn = entries.reduce((sum, e) => sum + Number(e.buy_in), 0);
  const totalCashOut = entries.reduce((sum, e) => sum + Number(e.cash_out ?? 0), 0);
  const diff = Math.abs(totalBuyIn - totalCashOut);

  if (diff > 0.01) {
    return `总买入 ${totalBuyIn} ≠ 总结算 ${totalCashOut}，差额 ${totalBuyIn - totalCashOut}`;
  }
  return null;
}

/**
 * 最小化转账的贪心算法
 * 输入：所有玩家的 entry（必须已填 cash_out）
 * 输出：谁转给谁多少钱
 */
export function calculateSettlement(entries: EntryWithPlayer[]): Transfer[] {
  const pool = entries.map((e) => ({
    name: e.players.name,
    playerId: e.player_id,
    amount: Number(e.cash_out ?? 0) - Number(e.buy_in),
  }));

  const winners = pool
    .filter((p) => p.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  const losers = pool
    .filter((p) => p.amount < 0)
    .sort((a, b) => a.amount - b.amount);

  const transfers: Transfer[] = [];
  let i = 0;
  let j = 0;

  while (i < winners.length && j < losers.length) {
    const winAmt = winners[i].amount;
    const loseAmt = Math.abs(losers[j].amount);
    const settle = Math.min(winAmt, loseAmt);

    transfers.push({
      from: losers[j].name,
      fromId: losers[j].playerId,
      to: winners[i].name,
      toId: winners[i].playerId,
      amount: Math.round(settle * 100) / 100,
    });

    winners[i].amount -= settle;
    losers[j].amount += settle;

    if (Math.abs(winners[i].amount) < 0.01) i++;
    if (Math.abs(losers[j].amount) < 0.01) j++;
  }

  return transfers;
}

/**
 * 生成结算文本（方便复制发群）
 */
export function formatSettlementText(
  transfers: Transfer[],
  sessionNote?: string | null
): string {
  const header = sessionNote ? `🃏 ${sessionNote} 结算单` : '🃏 结算单';
  const lines = transfers.map(
    (t) => `${t.from} → ${t.to}：${t.amount}`
  );
  return [header, '─'.repeat(20), ...lines].join('\n');
}
