'use client';

interface LocalEntry {
  id: string;
  player_id: string;
  buy_in: number;
  cash_out: number | null;
  remaining: string;
  players: { name: string };
}

interface Props {
  entry: LocalEntry;
  isOpen: boolean;
  confirmed: boolean;
  onBuyInChange: (entryId: string, value: string) => void;
  onBuyInSave: (entryId: string, value: number) => void;
  onRemainingChange: (entryId: string, value: string) => void;
  onCashOutSave: (entryId: string, remaining: string) => void;
  onConfirm: (entryId: string) => void;
  onUnconfirm: (entryId: string) => void;
  onRemove: (entryId: string) => void;
}

function selectOnFocus(e: React.FocusEvent<HTMLInputElement>) {
  e.target.select();
}

export default function EntryCard({
  entry,
  isOpen,
  confirmed,
  onBuyInChange,
  onBuyInSave,
  onRemainingChange,
  onCashOutSave,
  onConfirm,
  onUnconfirm,
  onRemove,
}: Props) {
  const net = Number(entry.remaining || 0) - Number(entry.buy_in);

  return (
    <div className={`bg-gray-800 rounded-xl p-4 transition-colors ${confirmed ? 'ring-2 ring-green-500 bg-green-900/10' : ''}`}>
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
        {isOpen && !confirmed && (
          <button
            onClick={() => onRemove(entry.id)}
            className="text-gray-600 hover:text-red-400 text-sm ml-2"
          >
            ✕
          </button>
        )}
      </div>

      <div className="grid grid-cols-[1fr_1fr_auto] gap-3 text-sm items-end">
        {/* Buy In */}
        <div>
          <label className="text-gray-500 block mb-1">买入</label>
          {isOpen && !confirmed ? (
            <input
              type="number"
              inputMode="numeric"
              pattern="[0-9]*"
              value={entry.buy_in}
              onFocus={selectOnFocus}
              onChange={(e) => onBuyInChange(entry.id, e.target.value)}
              onBlur={(e) =>
                onBuyInSave(entry.id, Number(e.target.value) || 0)
              }
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-center focus:outline-none focus:border-green-500 focus:bg-gray-600/50 transition-colors"
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
          {isOpen && !confirmed ? (
            <input
              type="number"
              inputMode="numeric"
              pattern="[0-9]*"
              value={entry.remaining}
              onFocus={selectOnFocus}
              onChange={(e) =>
                onRemainingChange(entry.id, e.target.value)
              }
              onBlur={() =>
                onCashOutSave(entry.id, entry.remaining)
              }
              placeholder="0"
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-center focus:outline-none focus:border-green-500 focus:bg-gray-600/50 transition-colors"
            />
          ) : (
            <div className="text-center py-2 font-mono">
              {entry.remaining || entry.cash_out || 0}
            </div>
          )}
        </div>

        {/* Confirm / Unconfirm */}
        {isOpen && (
          <div>
            <label className="text-gray-500 block mb-1">&nbsp;</label>
            {confirmed ? (
              <button
                onClick={() => onUnconfirm(entry.id)}
                className="px-3 py-2 rounded-lg text-red-400 bg-gray-700 border border-gray-600 text-sm whitespace-nowrap transition-colors hover:bg-red-900/30 press-effect"
              >
                取消确认
              </button>
            ) : (
              <button
                onClick={() => onConfirm(entry.id)}
                className="px-3 py-2 rounded-lg text-white bg-green-600 border border-green-500 text-sm whitespace-nowrap transition-colors hover:bg-green-700 press-effect"
              >
                确认
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
