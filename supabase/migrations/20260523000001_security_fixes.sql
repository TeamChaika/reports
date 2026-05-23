-- Security fixes from audit 2026-05-23

-- 1. Prevent self-role-escalation via profiles_update_own.
--    Original policy had no WITH CHECK, so a user could UPDATE role/is_active on their own row.
--    New policy restricts updates to display fields only (full_name, avatar_url).
drop policy if exists "profiles_update_own" on profiles;

create policy "profiles_update_own" on profiles
  for update
  using   (id = auth.uid())
  with check (
    id = auth.uid()
    -- Prevent the user from changing their own role or active status
    and role      = (select role      from profiles where id = auth.uid())
    and is_active = (select is_active from profiles where id = auth.uid())
  );

-- 2. Add (SELECT auth_role()) sub-select wrapper in key RLS policies for performance.
--    PostgreSQL evaluates STABLE functions once per row without caching;
--    wrapping in a sub-select forces a single evaluation per statement.
--    Applied to the most frequently-queried policies.
drop policy if exists "profiles_read" on profiles;
create policy "profiles_read" on profiles
  for select using (id = auth.uid() or (select is_admin_or_founder()));

drop policy if exists accounting_files_read on accounting_files;
create policy accounting_files_read on accounting_files
  for select using ((select auth_role()) in ('accountant', 'admin', 'founder'));

drop policy if exists accounting_files_insert on accounting_files;
create policy accounting_files_insert on accounting_files
  for insert with check ((select auth_role()) in ('accountant', 'admin', 'founder'));

drop policy if exists accounting_files_delete on accounting_files;
create policy accounting_files_delete on accounting_files
  for delete using ((select auth_role()) in ('accountant', 'admin', 'founder'));
