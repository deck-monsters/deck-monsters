-- Leaderboard stats, fight summaries, room fight counter, last_seen_at

alter table public.rooms
  add column if not exists fight_counter integer not null default 0;

alter table public.room_members
  add column if not exists last_seen_at timestamptz;

create table if not exists public.room_player_stats (
  room_id uuid not null references public.rooms (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  xp integer not null default 0,
  wins integer not null default 0,
  losses integer not null default 0,
  draws integer not null default 0,
  coins_earned integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create table if not exists public.room_monster_stats (
  room_id uuid not null references public.rooms (id) on delete cascade,
  monster_id text not null,
  owner_user_id uuid references public.profiles (id) on delete set null,
  display_name text not null,
  monster_type text not null,
  xp integer not null default 0,
  level integer not null default 1,
  wins integer not null default 0,
  losses integer not null default 0,
  draws integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (room_id, monster_id)
);

create table if not exists public.fight_summaries (
  id bigserial primary key,
  room_id uuid not null references public.rooms (id) on delete cascade,
  fight_number integer not null,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  outcome text not null,
  winner_monster_id text,
  winner_monster_name text,
  winner_owner_user_id uuid,
  loser_monster_id text,
  loser_monster_name text,
  loser_owner_user_id uuid,
  round_count integer not null,
  winner_xp_gained integer not null default 0,
  loser_xp_gained integer not null default 0,
  card_drop_name text,
  notable_cards text[],
  participants jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists fight_summaries_room_ended_idx
  on public.fight_summaries (room_id, ended_at desc);

create index if not exists fight_summaries_room_winner_monster_idx
  on public.fight_summaries (room_id, winner_monster_id);

create index if not exists fight_summaries_room_loser_monster_idx
  on public.fight_summaries (room_id, loser_monster_id);

create unique index if not exists fight_summaries_room_fight_number_key
  on public.fight_summaries (room_id, fight_number);
