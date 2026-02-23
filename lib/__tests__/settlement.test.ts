import { describe, it, expect } from 'vitest';
import { validateZeroSum, calculateSettlement, formatSettlementText } from '../settlement';
import { EntryWithPlayer } from '../types';

// Helper to create a mock entry
function makeEntry(
  name: string,
  buyIn: number,
  cashOut: number | null
): EntryWithPlayer {
  return {
    id: `entry-${name}`,
    session_id: 'session-1',
    player_id: `player-${name}`,
    buy_in: buyIn,
    cash_out: cashOut,
    created_at: '2025-01-01T00:00:00Z',
    players: { id: `player-${name}`, name, created_at: '2025-01-01T00:00:00Z' },
  };
}

describe('validateZeroSum', () => {
  it('returns null when buy_in equals cash_out', () => {
    const entries = [
      makeEntry('A', 400, 600),
      makeEntry('B', 400, 200),
    ];
    expect(validateZeroSum(entries)).toBeNull();
  });

  it('returns error message when totals differ', () => {
    const entries = [
      makeEntry('A', 400, 600),
      makeEntry('B', 400, 100),
    ];
    const result = validateZeroSum(entries);
    expect(result).not.toBeNull();
    expect(result).toContain('总买入');
    expect(result).toContain('总结算');
  });

  it('treats null cash_out as 0', () => {
    const entries = [
      makeEntry('A', 400, null),
      makeEntry('B', 400, 600),
    ];
    const result = validateZeroSum(entries);
    // totalBuyIn=800, totalCashOut=0+600=600, diff=200
    expect(result).not.toBeNull();
    expect(result).toContain('200');
  });

  it('handles single player with zero profit', () => {
    const entries = [makeEntry('A', 400, 400)];
    expect(validateZeroSum(entries)).toBeNull();
  });

  it('handles floating point precision within tolerance', () => {
    const entries = [
      makeEntry('A', 100, 150.005),
      makeEntry('B', 100, 49.995),
    ];
    expect(validateZeroSum(entries)).toBeNull();
  });
});

describe('calculateSettlement', () => {
  it('returns correct transfer for two players', () => {
    const entries = [
      makeEntry('Loser', 400, 200),
      makeEntry('Winner', 400, 600),
    ];
    const transfers = calculateSettlement(entries);
    expect(transfers).toHaveLength(1);
    expect(transfers[0]).toEqual({
      from: 'Loser',
      fromId: 'player-Loser',
      to: 'Winner',
      toId: 'player-Winner',
      amount: 200,
    });
  });

  it('handles three players correctly', () => {
    // A: +300, B: -100, C: -200
    const entries = [
      makeEntry('A', 400, 700),
      makeEntry('B', 400, 300),
      makeEntry('C', 400, 200),
    ];
    const transfers = calculateSettlement(entries);

    // Total amounts transferred should equal total debts
    const totalTransferred = transfers.reduce((s, t) => s + t.amount, 0);
    expect(totalTransferred).toBe(300);

    // All transfers should go to A
    for (const t of transfers) {
      expect(t.to).toBe('A');
    }
  });

  it('handles all players breaking even', () => {
    const entries = [
      makeEntry('A', 400, 400),
      makeEntry('B', 400, 400),
    ];
    const transfers = calculateSettlement(entries);
    expect(transfers).toHaveLength(0);
  });

  it('handles single player', () => {
    const entries = [makeEntry('A', 400, 400)];
    const transfers = calculateSettlement(entries);
    expect(transfers).toHaveLength(0);
  });

  it('handles multiple winners and losers', () => {
    // A: +200, B: +100, C: -150, D: -150
    const entries = [
      makeEntry('A', 400, 600),
      makeEntry('B', 400, 500),
      makeEntry('C', 400, 250),
      makeEntry('D', 400, 250),
    ];
    const transfers = calculateSettlement(entries);

    // Net should be zero-sum
    const totalFrom: Record<string, number> = {};
    const totalTo: Record<string, number> = {};
    for (const t of transfers) {
      totalFrom[t.from] = (totalFrom[t.from] || 0) + t.amount;
      totalTo[t.to] = (totalTo[t.to] || 0) + t.amount;
    }

    expect(totalTo['A']).toBe(200);
    expect(totalTo['B']).toBe(100);
    expect(totalFrom['C']).toBe(150);
    expect(totalFrom['D']).toBe(150);
  });

  it('does not mutate input entries', () => {
    const entries = [
      makeEntry('A', 400, 700),
      makeEntry('B', 400, 100),
    ];
    const originalBuyIn = entries.map((e) => e.buy_in);
    const originalCashOut = entries.map((e) => e.cash_out);

    calculateSettlement(entries);

    entries.forEach((e, i) => {
      expect(e.buy_in).toBe(originalBuyIn[i]);
      expect(e.cash_out).toBe(originalCashOut[i]);
    });
  });

  it('rounds amounts to two decimal places', () => {
    // Create a scenario where division could produce floating point issues
    const entries = [
      makeEntry('A', 100, 233.33),
      makeEntry('B', 100, 33.34),
      makeEntry('C', 100, 33.33),
    ];
    const transfers = calculateSettlement(entries);

    for (const t of transfers) {
      const decimals = t.amount.toString().split('.')[1];
      expect(!decimals || decimals.length <= 2).toBe(true);
    }
  });
});

describe('formatSettlementText', () => {
  it('formats transfers as readable text', () => {
    const transfers = [
      { from: 'B', fromId: 'b', to: 'A', toId: 'a', amount: 200 },
    ];
    const text = formatSettlementText(transfers);
    expect(text).toContain('结算单');
    expect(text).toContain('B → A：200');
  });

  it('includes session note in header', () => {
    const transfers = [
      { from: 'B', fromId: 'b', to: 'A', toId: 'a', amount: 100 },
    ];
    const text = formatSettlementText(transfers, '周五晚老王家');
    expect(text).toContain('周五晚老王家');
  });

  it('handles empty transfers', () => {
    const text = formatSettlementText([]);
    expect(text).toContain('结算单');
  });
});
