export interface Player {
  id: string;
  name: string;
  created_at: string;
}

export interface Session {
  id: string;
  note: string | null;
  status: 'open' | 'settled';
  created_at: string;
}

export interface Entry {
  id: string;
  session_id: string;
  player_id: string;
  buy_in: number;
  cash_out: number | null;
  created_at: string;
}

export interface EntryWithPlayer extends Entry {
  players: Player;
}

export interface Settlement {
  id: string;
  session_id: string;
  from_player_id: string;
  to_player_id: string;
  amount: number;
  created_at: string;
}

export interface SettlementWithPlayers extends Settlement {
  from_player: Player;
  to_player: Player;
}

export interface Transfer {
  from: string;
  fromId: string;
  to: string;
  toId: string;
  amount: number;
}
