-- Soft delete for accountant expenses — keep an audit trail, allow recovery
alter table accounting_expenses
  add column if not exists is_deleted boolean not null default false;

create index if not exists accounting_expenses_active
  on accounting_expenses (expense_date desc) where is_deleted = false;
