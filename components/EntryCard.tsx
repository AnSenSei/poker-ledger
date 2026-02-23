'use client';

interface LocalEntry {
  id: string;
  player_id: string;
  buy_in: number;
  cash_out: number | null;
  remaining: string;
  early: string;
  players: { name: string };
}

interface Props {
  entry: LocalEntry;
  isOpen: boolean;
  onBuyInChange: (entryId: string, value: string) => void;
  onBuyInSave: (entryId: string, value: number) => void;
  onRemainingChange: (entryId: string, value: string) => void;
  onEarlyChange: (entryId: string, value: string) => void;
  onCashOutSave: (entryId: string, remaining: string, early: string) => void;
  onRemove: (entryId: string) => void;
}

export default function EntryCard({
  entry,
  isOpen,
  onBuyInChange,
  onBuyInSave,
  onRemainingChange,
  onEarlyChange,
  onCashOutSave,
  onRemove,
}: Props) {
  const net =
    entry.cash_out != null
      ? Number(entry.cash_out) - Number(entry.buy_in)
      : null;

  return (
    <div className="bg-gray-800 rounded-xl p-4">
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
            onClick={() => onRemove(entry.id)}
            className="text-gray-600 hover:text-red-400 text-sm ml-2"
          >
            ✕
          </button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3 text-sm">
        {/* Buy In */}
        <div>
          <label className="text-gray-500 block mb-1">买入</label>
          {isOpen ? (
            <input
              type="number"
              inputMode="numeric"
              pattern="[0-9]*"
              value={entry.buy_in}
              onChange={(e) => onBuyInChange(entry.id, e.target.value)}
              onBlur={(e) =>
                onBuyInSave(entry.id, Number(e.target.value) || 0)
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
          <label className="text-gray-500 block mb-1">剩余筹码</label>
          {isOpen ? (
            <input
              type="number"
              inputMode="numeric"
              pattern="[0-9]*"
              value={entry.remaining}
              onChange={(e) =>
                onRemainingChange(entry.id, e.target.value)
              }
              onBlur={() =>
                onCashOutSave(entry.id, entry.remaining, entry.early)
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
          <label className="text-gray-500 block mb-1">已兑出</label>
          {isOpen ? (
            <input
              type="number"
              inputMode="numeric"
              pattern="[0-9]*"
              value={entry.early}
              onChange={(e) =>
                onEarlyChange(entry.id, e.target.value)
              }
              onBlur={() =>
                onCashOutSave(entry.id, entry.remaining, entry.early)
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
}
