-- Roadmap 37 (expand): room state as jsonb.
--
-- rooms.state_blob holds base64(gzip(JSON)), a leftover from when the game kept state as a
-- string in whatever store its host offered. SQL cannot see inside it: answering "which
-- Dragons own Enchanted Faceswap?" meant decoding every blob by hand. The new columns hold the
-- same serialized Game as jsonb.
--
-- This migration is additive only, so the previous release keeps working against it. The
-- server dual-writes state and state_blob until the contract release drops state_blob.
--
-- state_version orders saves: every snapshot is stamped from one process-wide monotonic clock
-- when it is taken, and an update lands only when the stored version is lower. Nothing rewinds
-- it (not a reload, a reset, or the backfill), so a save still in flight from an evicted or
-- reset game can never overwrite newer state.

alter table public.rooms
  add column if not exists state jsonb,
  add column if not exists state_version bigint not null default 0,
  add column if not exists quarantined_state jsonb;

comment on column public.rooms.state is
  'The room''s serialized Game ({ name, options }), written by the server''s PostgresStateStore. Replaces state_blob (roadmap 37).';
comment on column public.rooms.state_version is
  'Monotonic save stamp; a save lands only when newer, and it never rewinds (roadmap 37).';
comment on column public.rooms.quarantined_state is
  'The jsonb state of a room whose state failed to restore or was reset (roadmap 37).';
comment on column public.rooms.state_blob is
  'DEPRECATED (roadmap 37): base64(gzip(JSON)). Dual-written until the contract release drops it.';
