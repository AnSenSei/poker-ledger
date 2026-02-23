-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ==========================================
-- Players
-- ==========================================
create table players (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  created_at timestamp with time zone default now()
);

-- ==========================================
-- Sessions (一场牌局)
-- ==========================================
create table sessions (
  id uuid primary key default uuid_generate_v4(),
  note text,
  status text not null default 'open' check (status in ('open', 'settled')),
  created_at timestamp with time zone default now()
);

-- ==========================================
-- Entries (每人每场的数据)
-- buy_in: 总买入（含 re-buy）
-- cash_out: 最终总结算 = 剩余筹码 + 已提前兑出
-- ==========================================
create table entries (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid not null references sessions(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  buy_in numeric not null default 400,
  cash_out numeric,
  created_at timestamp with time zone default now(),
  unique(session_id, player_id)
);

-- ==========================================
-- Settlements (结算转账记录)
-- ==========================================
create table settlements (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid not null references sessions(id) on delete cascade,
  from_player_id uuid not null references players(id),
  to_player_id uuid not null references players(id),
  amount numeric not null,
  created_at timestamp with time zone default now()
);

-- ==========================================
-- Indexes
-- ==========================================
create index idx_entries_session on entries(session_id);
create index idx_entries_player on entries(player_id);
create index idx_settlements_session on settlements(session_id);

-- ==========================================
-- RLS (disabled for simplicity — friends only app)
-- ==========================================
alter table players enable row level security;
alter table sessions enable row level security;
alter table entries enable row level security;
alter table settlements enable row level security;

create policy "Allow all" on players for all using (true) with check (true);
create policy "Allow all" on sessions for all using (true) with check (true);
create policy "Allow all" on entries for all using (true) with check (true);
create policy "Allow all" on settlements for all using (true) with check (true);
