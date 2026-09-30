-- The Supabase-provided pieces the repo's migrations lean on, absent from plain Postgres.
-- CI runs this on its postgres:16 service before applying supabase/migrations with the
-- migration runner, so the real-Postgres tests see the production schema (roadmap 10, item H).
-- Keep in step with SUPABASE_STUBS in src/migrate.pg.test.ts.
do $$ begin
	if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
	if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
	if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role; end if;
exception when duplicate_object then null; end $$;
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key, email text, raw_user_meta_data jsonb);
create or replace function auth.uid() returns uuid language sql as $$ select null::uuid $$;
create or replace function auth.jwt() returns jsonb language sql as $$ select '{}'::jsonb $$;
