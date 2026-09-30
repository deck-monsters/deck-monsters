-- Bug G: a room reset in one process must reach every other process's loaded copy.
--
-- The server and the Discord connector each run their own RoomManager over this table. A reset
-- detaches the resetting process's copy and writes a tombstone state_version, but the other
-- process's loaded copy stamps its next save from the clock, after the tombstone, so it landed
-- and brought the old room back.
--
-- state_generation is bumped by a reset (in the same update that writes the tombstone). A loaded
-- room remembers the generation it loaded, and every save also requires state_generation to
-- match, so a save from before the reset matches no row and that process drops its copy.
--
-- Additive only: a release that does not know the column keeps writing with the version guard,
-- and the tombstone version still refuses its stale saves.

alter table public.rooms
  add column if not exists state_generation bigint not null default 0;

comment on column public.rooms.state_generation is
  'Bumped by a room reset. A save must carry the generation its process loaded, or it is refused and that process drops its copy (bug G).';
