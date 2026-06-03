-- Accountant-entered expenses (cash / non-cash), not tied to shift reports,
-- optionally distributed across several establishments.

create table if not exists accounting_expenses (
  id            uuid primary key default gen_random_uuid(),
  expense_date  date not null,
  name          text not null,
  group_id      uuid references expense_groups(id),     -- category
  payment_type  text not null check (payment_type in ('cash', 'noncash')),
  total_amount  numeric(14,2) not null,
  note          text,
  created_by    uuid references profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);

create index if not exists accounting_expenses_date on accounting_expenses (expense_date desc);

-- How the total is split across establishments (one row per establishment).
-- Single-establishment expense → one row with the full amount.
create table if not exists accounting_expense_allocations (
  id               uuid primary key default gen_random_uuid(),
  expense_id       uuid not null references accounting_expenses(id) on delete cascade,
  establishment_id uuid not null references establishments(id),
  amount           numeric(14,2) not null
);

create index if not exists acc_exp_alloc_expense on accounting_expense_allocations (expense_id);
create index if not exists acc_exp_alloc_est on accounting_expense_allocations (establishment_id);

alter table accounting_expenses             enable row level security;
alter table accounting_expense_allocations  enable row level security;

create policy accounting_expenses_rw on accounting_expenses
  for all
  using ((select auth_role()) in ('accountant', 'admin', 'founder'))
  with check ((select auth_role()) in ('accountant', 'admin', 'founder'));

create policy acc_exp_alloc_rw on accounting_expense_allocations
  for all
  using ((select auth_role()) in ('accountant', 'admin', 'founder'))
  with check ((select auth_role()) in ('accountant', 'admin', 'founder'));
