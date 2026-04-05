-- Deck Monsters — initial schema
-- Tables: profiles, user_connectors, rooms, room_events, room_members

-- ────────────────────────────────────────────────────────────
-- profiles
-- Mirrors auth.users; created automatically via trigger below.
-- ────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  created_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Auto-create a profile row when a new auth user is registered
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email, '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ────────────────────────────────────────────────────────────
-- user_connectors
-- Maps external identities (Discord user ID, etc.) to profiles.
-- ────────────────────────────────────────────────────────────
create table if not exists public.user_connectors (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles (id) on delete cascade,
  connector_type text not null,
  external_id    text not null,
  created_at     timestamptz not null default now(),
  unique (connector_type, external_id)
);

alter table public.user_connectors enable row level security;

create policy "Users can manage their own connectors"
  on public.user_connectors for all
  using (auth.uid() = user_id);


-- ────────────────────────────────────────────────────────────
-- rooms
-- A game room; owns the serialized Game state blob.
-- ────────────────────────────────────────────────────────────
create table if not exists public.rooms (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  owner_id    uuid not null references public.profiles (id),
  invite_code text not null unique,
  state_blob  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.rooms enable row level security;

create policy "Room owners can update rooms"
  on public.rooms for update
  using (owner_id = auth.uid());


-- ────────────────────────────────────────────────────────────
-- room_members
-- Membership + role for each user in a room.
-- ────────────────────────────────────────────────────────────
create table if not exists public.room_members (
  room_id   uuid not null references public.rooms (id) on delete cascade,
  user_id   uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  role      text not null default 'member',
  primary key (room_id, user_id)
);

alter table public.room_members enable row level security;

create policy "Members can view membership"
  on public.room_members for select
  using (user_id = auth.uid());

create policy "Members can leave (delete own membership)"
  on public.room_members for delete
  using (user_id = auth.uid());

-- Deferred: depends on room_members existing
create policy "Room members can view rooms"
  on public.rooms for select
  using (
    exists (
      select 1 from public.room_members
      where room_id = rooms.id and user_id = auth.uid()
    )
  );


-- ────────────────────────────────────────────────────────────
-- room_events
-- Append-only event log for ring broadcasts and private DMs.
-- ────────────────────────────────────────────────────────────
create table if not exists public.room_events (
  id             bigserial primary key,
  room_id        uuid not null references public.rooms (id) on delete cascade,
  type           text not null,
  scope          text not null check (scope in ('public', 'private')),
  target_user_id uuid references public.profiles (id),
  payload        jsonb not null default '{}',
  text           text not null default '',
  created_at     timestamptz not null default now()
);

create index if not exists room_events_room_id_id_idx
  on public.room_events (room_id, id);

alter table public.room_events enable row level security;

create policy "Members can read public events for their rooms"
  on public.room_events for select
  using (
    scope = 'public'
    and exists (
      select 1 from public.room_members
      where room_id = room_events.room_id and user_id = auth.uid()
    )
  );

create policy "Users can read their own private events"
  on public.room_events for select
  using (scope = 'private' and target_user_id = auth.uid());
