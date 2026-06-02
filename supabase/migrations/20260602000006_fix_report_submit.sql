-- Fix: managers could not submit reports.
-- The previous daily_reports_update policy had only USING (no WITH CHECK), so
-- Postgres applied USING to the NEW row too. The manager branch requires
-- status = 'draft', which fails when transitioning draft → submitted, blocking
-- submission. Add an explicit WITH CHECK that allows managers to move their own
-- establishment's reports from draft to submitted (but not to reviewed/approved).

drop policy if exists "daily_reports_update" on daily_reports;

create policy "daily_reports_update" on daily_reports
  for update using (
    (establishment_id in (select my_establishment_ids()) and status = 'draft')
    or is_admin_or_founder()
    or auth_role() = 'accountant'
  )
  with check (
    (establishment_id in (select my_establishment_ids()) and status in ('draft', 'submitted'))
    or is_admin_or_founder()
    or auth_role() = 'accountant'
  );
