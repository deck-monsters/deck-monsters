-- Roadmap 37 contract: drop rooms.state_blob.
--
-- Release 2 stopped writing state_blob and kept only a read-only load fallback, so the column is
-- now stale for every converted room. A room with `state` null and a blob present has its ONLY
-- copy in the blob; dropping the column would lose it. The guard refuses the drop in that case
-- (the migration runs in one transaction, so nothing is changed). Every production room already
-- has `state`, so this passes there.
--
-- quarantined_blob stays: it holds recovered copies for inspection.
--
-- Rollback: a release before release 2 reads and writes state_blob, so it cannot run against
-- this schema. Restoring the column requires a backup (docs/operations/deployment.md).

do $$
begin
  if exists (select 1 from rooms where state is null and state_blob is not null) then
    raise exception 'rooms still unconverted (state null, state_blob present): convert or reset them first; see "The drop" in docs/operations/deployment.md';
  end if;
end $$;

alter table rooms drop column if exists state_blob;
