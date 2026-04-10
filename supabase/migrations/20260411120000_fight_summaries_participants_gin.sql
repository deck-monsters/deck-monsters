-- Idempotent: add GIN index on fight_summaries.participants for JSONB containment
-- (e.g. monster fight history). Safe if already applied in an earlier migration.
create index if not exists fight_summaries_participants_gin_idx
  on public.fight_summaries using gin (participants);
