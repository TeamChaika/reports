-- Fix handle_new_user: set explicit search_path so profiles table resolves correctly
-- inside a SECURITY DEFINER function called from auth schema context.
create or replace function handle_new_user()
returns trigger language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email)
  );
  return new;
end;
$$;
