create table if not exists accounting_files (
  id           uuid primary key default gen_random_uuid(),
  business_date date not null,
  type         text not null check (type in ('nal', 'bn')),
  file_name    text not null,
  storage_path text not null,
  uploaded_by  uuid references profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);

create index if not exists accounting_files_date_type
  on accounting_files (business_date desc, type);

alter table accounting_files enable row level security;

create policy accounting_files_read on accounting_files
  for select using (auth_role() in ('accountant', 'admin', 'founder'));

create policy accounting_files_insert on accounting_files
  for insert with check (auth_role() in ('accountant', 'admin', 'founder'));

create policy accounting_files_delete on accounting_files
  for delete using (auth_role() in ('accountant', 'admin', 'founder'));
