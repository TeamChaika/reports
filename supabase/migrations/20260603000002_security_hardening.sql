-- Security hardening (audit follow-up)

-- H-6: Accountants must not be able to edit daily_reports (status, revenue, iiko_total).
-- Their only write paths are expense categorization and accounting files.
-- Remove the broad accountant branch; managers may move their own drafts to
-- submitted, founders/admins may do anything.
drop policy if exists "daily_reports_update" on daily_reports;

create policy "daily_reports_update" on daily_reports
  for update using (
    (establishment_id in (select my_establishment_ids()) and status = 'draft')
    or is_admin_or_founder()
  )
  with check (
    (establishment_id in (select my_establishment_ids()) and status in ('draft', 'submitted'))
    or is_admin_or_founder()
  );
