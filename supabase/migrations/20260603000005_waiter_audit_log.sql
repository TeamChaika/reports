-- Audit log: which manager created or edited which waiter
create table if not exists waiter_audit_log (
  id                uuid primary key default gen_random_uuid(),
  action            text not null check (action in ('create', 'update')),
  iiko_employee_id  uuid not null,
  employee_name     text not null,
  establishment_id  uuid references establishments(id),
  performed_by      uuid references profiles(id) on delete set null,
  details           jsonb not null default '{}',
  created_at        timestamptz not null default now()
);

create index if not exists waiter_audit_log_created on waiter_audit_log (created_at desc);
create index if not exists waiter_audit_log_emp on waiter_audit_log (iiko_employee_id);

alter table waiter_audit_log enable row level security;

-- Founders/admins read the whole log; managers may read their own entries
create policy waiter_audit_log_read on waiter_audit_log
  for select using (
    is_admin_or_founder()
    or performed_by = auth.uid()
  );
