-- Ring events: record which encounter modifier (if any) was in force for a fight,
-- so the web fight log can label it. See engine `ring/ring-events.ts` and
-- `docs/boss-encounters.md`.
--
-- fight_summaries already has RLS enabled (20260415000000_rls_missing_tables.sql),
-- and policies are table-wide, so no policy change is needed for a new column.

alter table public.fight_summaries
  add column if not exists ring_event text;
