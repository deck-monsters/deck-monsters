-- Enforce exactly one default room per Discord guild (#70).
-- Persist each user's active room per guild (#72).

-- Demote extra defaults so the unique partial index can be created safely.
-- Keep the first row per guild (stable by room_id) as the sole default.
WITH ranked AS (
  SELECT
    guild_id,
    room_id,
    ROW_NUMBER() OVER (PARTITION BY guild_id ORDER BY room_id) AS rn
  FROM public.guild_rooms
  WHERE is_default = true
)
UPDATE public.guild_rooms gr
SET is_default = false
FROM ranked r
WHERE gr.guild_id = r.guild_id
  AND gr.room_id = r.room_id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS guild_rooms_one_default_per_guild_idx
  ON public.guild_rooms (guild_id)
  WHERE is_default = true;

-- Active room selection: (guild_id, canonical supabase user_id) → room_id.
-- Scoped to guild_rooms so a room must belong to the guild; cascades clean up
-- when the room, guild mapping, or user is removed.
CREATE TABLE IF NOT EXISTS public.guild_user_active_rooms (
  guild_id   text not null,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  room_id    uuid not null,
  updated_at timestamptz not null default now(),
  primary key (guild_id, user_id),
  foreign key (guild_id, room_id)
    references public.guild_rooms (guild_id, room_id)
    on delete cascade
);

CREATE INDEX IF NOT EXISTS guild_user_active_rooms_room_id_idx
  ON public.guild_user_active_rooms (room_id);

ALTER TABLE public.guild_user_active_rooms ENABLE ROW LEVEL SECURITY;

-- Users can see their own active-room mapping (server writes via service_role).
CREATE POLICY "Users can view their own guild active rooms"
  ON public.guild_user_active_rooms FOR SELECT
  USING (user_id = auth.uid());
