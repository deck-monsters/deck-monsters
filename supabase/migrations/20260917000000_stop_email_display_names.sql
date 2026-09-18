-- Never persist an email address as a public profile name.
--
-- Older versions of handle_new_user fell back to new.email. Besides fixing future
-- sign-ups, replace existing email-shaped names with a stable pseudonymous handle so a
-- missed display-name read cannot disclose the address again.

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  candidate text;
  generated_handle text := 'Beastmaster-' || left(replace(new.id::text, '-', ''), 8);
begin
  candidate := coalesce(
    nullif(trim(new.raw_user_meta_data->>'display_name'), ''),
    nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
    generated_handle
  );

  -- OAuth providers can put an email address in full_name/display_name too. Treat any
  -- email-shaped candidate as absent rather than trusting which metadata key supplied it.
  if candidate ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    candidate := generated_handle;
  end if;

  insert into public.profiles (id, display_name)
  values (new.id, candidate)
  on conflict (id) do nothing;
  return new;
end;
$$;

update public.profiles
set display_name = 'Beastmaster-' || left(replace(id::text, '-', ''), 8)
where trim(display_name) ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$';
