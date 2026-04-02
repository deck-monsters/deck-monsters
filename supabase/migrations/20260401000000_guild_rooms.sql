-- guild_rooms
-- Maps Discord guild IDs to game rooms.
-- Each guild has one default room; sub-rooms are supported via is_default = false.

create table if not exists public.guild_rooms (
  guild_id   text not null,
  room_id    uuid not null references public.rooms (id) on delete cascade,
  channel_id text,           -- Discord channel ID for public announcements
  is_default boolean not null default true,
  primary key (guild_id, room_id)
);

create index if not exists guild_rooms_guild_id_idx on public.guild_rooms (guild_id);
