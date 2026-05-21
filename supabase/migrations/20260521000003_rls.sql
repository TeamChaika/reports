-- Row Level Security policies
-- Roles: admin, founder, accountant, manager

alter table establishments       enable row level security;
alter table profiles             enable row level security;
alter table establishment_users  enable row level security;
alter table daily_reports        enable row level security;
alter table report_items         enable row level security;
alter table report_expenses      enable row level security;
alter table report_prepayments   enable row level security;
alter table iiko_departments     enable row level security;
alter table iiko_products        enable row level security;
alter table iiko_employees       enable row level security;
alter table iiko_stores          enable row level security;
alter table iiko_pay_types       enable row level security;
alter table iiko_olap_cache      enable row level security;
alter table sync_jobs            enable row level security;

-- ─── Helper functions ─────────────────────────────────────────────────────────
create or replace function auth_role()
returns text language sql stable security definer as $$
  select role from profiles where id = auth.uid()
$$;

create or replace function is_admin_or_founder()
returns boolean language sql stable security definer as $$
  select auth_role() in ('admin', 'founder')
$$;

create or replace function my_establishment_ids()
returns setof uuid language sql stable security definer as $$
  select establishment_id from establishment_users where user_id = auth.uid()
$$;

-- ─── iiko reference tables: readable by all authenticated users ───────────────
create policy "iiko_departments_read" on iiko_departments
  for select using (auth.uid() is not null);

create policy "iiko_products_read" on iiko_products
  for select using (auth.uid() is not null);

create policy "iiko_employees_read" on iiko_employees
  for select using (auth.uid() is not null);

create policy "iiko_stores_read" on iiko_stores
  for select using (auth.uid() is not null);

create policy "iiko_pay_types_read" on iiko_pay_types
  for select using (auth.uid() is not null);

create policy "iiko_olap_cache_read" on iiko_olap_cache
  for select using (auth.uid() is not null);

-- ─── sync_jobs: admin/founder only ───────────────────────────────────────────
create policy "sync_jobs_admin" on sync_jobs
  for all using (is_admin_or_founder());

-- ─── profiles: own row + founders/admins see all ─────────────────────────────
create policy "profiles_own" on profiles
  for select using (id = auth.uid() or is_admin_or_founder());

create policy "profiles_update_own" on profiles
  for update using (id = auth.uid());

-- ─── establishments: all authenticated see list, admin manages ────────────────
create policy "establishments_read" on establishments
  for select using (auth.uid() is not null);

create policy "establishments_admin" on establishments
  for all using (is_admin_or_founder());

-- ─── establishment_users: managers see own, admins see all ───────────────────
create policy "establishment_users_read" on establishment_users
  for select using (user_id = auth.uid() or is_admin_or_founder());

create policy "establishment_users_admin" on establishment_users
  for all using (is_admin_or_founder());

-- ─── daily_reports ───────────────────────────────────────────────────────────
-- founders/admins/accountants: все отчёты
-- managers: только свои заведения
create policy "daily_reports_read" on daily_reports
  for select using (
    is_admin_or_founder()
    or auth_role() = 'accountant'
    or establishment_id in (select my_establishment_ids())
  );

create policy "daily_reports_insert" on daily_reports
  for insert with check (
    establishment_id in (select my_establishment_ids())
    or is_admin_or_founder()
  );

create policy "daily_reports_update" on daily_reports
  for update using (
    -- менеджеры могут редактировать только draft-отчёты своих заведений
    (establishment_id in (select my_establishment_ids()) and status = 'draft')
    or is_admin_or_founder()
    or auth_role() = 'accountant'
  );

-- ─── report sub-tables (items, expenses, prepayments) ────────────────────────
-- политики аналогичны daily_reports через report_id
create policy "report_items_read" on report_items
  for select using (
    report_id in (
      select id from daily_reports
      where is_admin_or_founder()
         or auth_role() = 'accountant'
         or establishment_id in (select my_establishment_ids())
    )
  );

create policy "report_items_write" on report_items
  for all using (
    report_id in (
      select id from daily_reports
      where (establishment_id in (select my_establishment_ids()) and status = 'draft')
         or is_admin_or_founder()
    )
  );

create policy "report_expenses_read" on report_expenses
  for select using (
    report_id in (
      select id from daily_reports
      where is_admin_or_founder()
         or auth_role() = 'accountant'
         or establishment_id in (select my_establishment_ids())
    )
  );

create policy "report_expenses_write" on report_expenses
  for all using (
    report_id in (
      select id from daily_reports
      where (establishment_id in (select my_establishment_ids()) and status = 'draft')
         or is_admin_or_founder()
    )
  );

create policy "report_prepayments_read" on report_prepayments
  for select using (
    report_id in (
      select id from daily_reports
      where is_admin_or_founder()
         or auth_role() = 'accountant'
         or establishment_id in (select my_establishment_ids())
    )
  );

create policy "report_prepayments_write" on report_prepayments
  for all using (
    report_id in (
      select id from daily_reports
      where (establishment_id in (select my_establishment_ids()) and status = 'draft')
         or is_admin_or_founder()
    )
  );
