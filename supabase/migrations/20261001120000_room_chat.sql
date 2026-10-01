-- Room chat (roadmap 41). Chat is not game state and never rides the room's game event
-- stream (every public event is posted to Discord and counted for fight pacing), so it has
-- its own tables. Written and read only by the server through tRPC.
--
-- recipient_user_id null = the whole room; otherwise a DM visible only to sender and
-- recipient. sender/recipient carry no foreign key on purpose: a message must outlive a
-- player who left, until the retention sweep removes it.

create table if not exists public.room_messages (
  id bigserial primary key,
  room_id uuid not null references public.rooms(id) on delete cascade,
  sender_user_id uuid not null,
  recipient_user_id uuid,
  text text not null,
  fight_number integer,
  source text not null default 'web',
  created_at timestamptz not null default now()
);

-- Room history, newest-first paging, and the per-room cap in the sweep.
create index if not exists room_messages_room_id_id_idx
  on public.room_messages (room_id, id);
-- DM history: "sent to me" lookups within a room.
create index if not exists room_messages_room_recipient_id_idx
  on public.room_messages (room_id, recipient_user_id, id);
-- The 30-day / 7-day sweep.
create index if not exists room_messages_created_at_idx
  on public.room_messages (created_at);

-- Per player and room: the newest message id they have read.
create table if not exists public.room_message_reads (
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null,
  last_read_id bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

-- Server-only: RLS on with no policies, and no grants for the browser roles. The
-- browser never reads these tables; DMs must not be readable through the Supabase API.
alter table public.room_messages enable row level security;
alter table public.room_message_reads enable row level security;
revoke all on public.room_messages from anon, authenticated;
revoke all on public.room_message_reads from anon, authenticated;
revoke all on sequence public.room_messages_id_seq from anon, authenticated;
