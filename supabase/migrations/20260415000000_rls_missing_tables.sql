-- Enable Row-Level Security on tables that were added without it.
-- Supabase flagged these as publicly accessible (rls_disabled_in_public).
--
-- Access model:
--   guild_rooms        — readable by room members; written only by the server
--   room_player_stats  — readable by room members; written only by the server
--   room_monster_stats — readable by room members; written only by the server
--   fight_summaries    — readable by room members; written only by the server
--
-- All four tables are append/update only from server-side logic (service_role),
-- so no authenticated-user write policies are needed.

-- ─────────────────────────────────────────────────────────────────────────────
-- guild_rooms
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.guild_rooms enable row level security;

-- Any room member can see which guild(s) their room is linked to.
create policy "Room members can view guild_rooms"
  on public.guild_rooms for select
  using (
    exists (
      select 1 from public.room_members
      where room_members.room_id = guild_rooms.room_id
        and room_members.user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- room_player_stats  (leaderboard)
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.room_player_stats enable row level security;

-- Room members can view the leaderboard for their room.
create policy "Room members can view player stats"
  on public.room_player_stats for select
  using (
    exists (
      select 1 from public.room_members
      where room_members.room_id = room_player_stats.room_id
        and room_members.user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- room_monster_stats
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.room_monster_stats enable row level security;

-- Room members can view monster stats / rankings for their room.
create policy "Room members can view monster stats"
  on public.room_monster_stats for select
  using (
    exists (
      select 1 from public.room_members
      where room_members.room_id = room_monster_stats.room_id
        and room_members.user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- fight_summaries
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.fight_summaries enable row level security;

-- Room members can view the fight history for their room.
create policy "Room members can view fight summaries"
  on public.fight_summaries for select
  using (
    exists (
      select 1 from public.room_members
      where room_members.room_id = fight_summaries.room_id
        and room_members.user_id = auth.uid()
    )
  );
