-- Report form redesign:
-- 1. Payment groups replace individual pay types in the form
-- 2. Collaborative expenses with approvers
-- 3. cash_start/cash_end → cash_submitted
-- 4. Remove prepayments from form (table stays for historical data)

-- ─── Payment groups (Группы оплаты) ──────────────────────────────────────────
create table payment_groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  code        text not null unique,  -- cash | card | hookah | online | other
  maps_to     text not null default 'other' check (maps_to in ('cash', 'card', 'other')),
  sort_order  int not null default 0,
  is_active   boolean not null default true
);

insert into payment_groups (name, code, maps_to, sort_order) values
  ('Наличные',    'cash',   'cash',  1),
  ('Безналичные', 'card',   'card',  2),
  ('Кальяны',     'hookah', 'other', 3),
  ('Онлайн',      'online', 'card',  4),
  ('Прочие',      'other',  'other', 99);

-- ─── Expense groups (Категории расходов) ──────────────────────────────────────
create table expense_groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  sort_order  int not null default 0,
  is_active   boolean not null default true
);

insert into expense_groups (name, sort_order) values
  ('Хозяйственные расходы', 1),
  ('Реклама и маркетинг',   2),
  ('Продукты и ингредиенты',3),
  ('Оборудование и ремонт', 4),
  ('Коммунальные услуги',   5),
  ('Инкассация и банк',     6),
  ('Прочие расходы',        99);

-- ─── Expense approvers (Согласующие расходы) ─────────────────────────────────
create table expense_approvers (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  short_name  text not null,
  is_global   boolean not null default false,  -- может согласовывать в любом заведении
  is_active   boolean not null default true
);

-- ─── Establishment-level approvers (для не-глобальных) ───────────────────────
create table establishment_approvers (
  establishment_id  uuid not null references establishments(id) on delete cascade,
  approver_id       uuid not null references expense_approvers(id) on delete cascade,
  primary key (establishment_id, approver_id)
);

-- ─── Modify report_items ──────────────────────────────────────────────────────
-- pay_type (text) → pay_group (text, group name) + pay_group_id (FK)
alter table report_items rename column pay_type to pay_group;
alter table report_items
  add column pay_group_id uuid references payment_groups(id);

-- ─── Modify report_expenses ───────────────────────────────────────────────────
alter table report_expenses rename column category to name;
alter table report_expenses
  add column group_id      uuid references expense_groups(id),
  add column approver_id   uuid references expense_approvers(id),
  add column approver_name text,
  add column added_by      uuid references profiles(id);

-- ─── Modify daily_reports ─────────────────────────────────────────────────────
alter table daily_reports
  drop column cash_start,
  drop column cash_end,
  add column cash_submitted numeric(14,2);

-- ─── iiko_pay_types: добавить маппинг на группу ───────────────────────────────
alter table iiko_pay_types
  add column group_id uuid references payment_groups(id);

-- ─── RLS for new tables ───────────────────────────────────────────────────────
alter table payment_groups         enable row level security;
alter table expense_groups         enable row level security;
alter table expense_approvers      enable row level security;
alter table establishment_approvers enable row level security;

create policy "payment_groups_read" on payment_groups
  for select using (auth.uid() is not null);

create policy "expense_groups_read" on expense_groups
  for select using (auth.uid() is not null);

create policy "expense_approvers_read" on expense_approvers
  for select using (auth.uid() is not null);

create policy "establishment_approvers_read" on establishment_approvers
  for select using (auth.uid() is not null);

create policy "payment_groups_admin" on payment_groups
  for all using (is_admin_or_founder());

create policy "expense_groups_admin" on expense_groups
  for all using (is_admin_or_founder());

create policy "expense_approvers_admin" on expense_approvers
  for all using (is_admin_or_founder());

create policy "establishment_approvers_admin" on establishment_approvers
  for all using (is_admin_or_founder());
