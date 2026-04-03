-- Fix handle_new_user trigger: read display_name from user_metadata instead of full_name.
-- connector-users.ts passes display_name in user_metadata when creating connector users;
-- the original trigger read full_name which caused empty display names for connector users.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'display_name',
      new.raw_user_meta_data->>'full_name',
      new.email,
      ''
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
