-- App core tables: establishments, users, reports

-- ─── Establishments (заведения — маппинг iiko → приложение) ──────────────────
create table establishments (
  id                  uuid primary key default gen_random_uuid(),
  iiko_department_id  uuid references iiko_departments(id),
  name                text not null,
  code                text,                 -- iiko код заведения
  telegram_chat_id    bigint,               -- чат для уведомлений (опционально)
  is_active           boolean not null default true,
  config              jsonb not null default '{}',  -- настройки формы отчёта
  created_at          timestamptz not null default now()
);

create unique index on establishments (iiko_department_id) where iiko_department_id is not null;
create index on establishments (code);

-- ─── Profiles (расширение auth.users) ────────────────────────────────────────
create table profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  full_name     text,
  role          text not null default 'manager',  -- manager | accountant | founder | admin
  telegram_id   bigint unique,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index on profiles (role);
create index on profiles (telegram_id);

-- ─── Establishment Users (доступ пользователей к заведениям) ─────────────────
create table establishment_users (
  establishment_id  uuid not null references establishments(id) on delete cascade,
  user_id           uuid not null references profiles(id) on delete cascade,
  primary key (establishment_id, user_id)
);

-- ─── Daily Reports (сменные отчёты) ──────────────────────────────────────────
create table daily_reports (
  id                uuid primary key default gen_random_uuid(),
  establishment_id  uuid not null references establishments(id),
  business_date     date not null,
  status            text not null default 'draft',  -- draft | submitted | reviewed | approved
  source            text not null default 'web',    -- telegram | web
  submitted_by      uuid references profiles(id),
  submitted_at      timestamptz,
  reviewed_by       uuid references profiles(id),
  reviewed_at       timestamptz,
  notes             text,

  -- Выручка по типам оплаты (суммируется из report_items)
  revenue_cash      numeric(14,2) not null default 0,   -- наличные
  revenue_card      numeric(14,2) not null default 0,   -- безнал / карты
  revenue_other     numeric(14,2) not null default 0,   -- прочие типы
  revenue_total     numeric(14,2) generated always as
                    (revenue_cash + revenue_card + revenue_other) stored,

  -- Касса
  cash_start        numeric(14,2),  -- касса на начало смены
  cash_end          numeric(14,2),  -- касса на конец смены

  -- Сверка с iiko
  iiko_total        numeric(14,2),  -- итого из iiko OLAP
  iiko_synced_at    timestamptz,
  iiko_diff         numeric(14,2) generated always as
                    (revenue_cash + revenue_card + revenue_other - coalesce(iiko_total, 0)) stored,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  unique (establishment_id, business_date)
);

create index on daily_reports (establishment_id, business_date desc);
create index on daily_reports (status);
create index on daily_reports (business_date desc);

-- ─── Report Items (разбивка выручки по типам оплаты) ─────────────────────────
create table report_items (
  id          uuid primary key default gen_random_uuid(),
  report_id   uuid not null references daily_reports(id) on delete cascade,
  pay_type    text not null,      -- название типа оплаты
  amount      numeric(14,2) not null default 0,
  created_at  timestamptz not null default now()
);

create index on report_items (report_id);

-- ─── Report Expenses (расходы за смену) ──────────────────────────────────────
create table report_expenses (
  id          uuid primary key default gen_random_uuid(),
  report_id   uuid not null references daily_reports(id) on delete cascade,
  category    text not null,
  description text,
  amount      numeric(14,2) not null,
  created_at  timestamptz not null default now()
);

create index on report_expenses (report_id);

-- ─── Report Prepayments (авансы сотрудникам) ─────────────────────────────────
create table report_prepayments (
  id              uuid primary key default gen_random_uuid(),
  report_id       uuid not null references daily_reports(id) on delete cascade,
  employee_id     uuid references iiko_employees(id),
  employee_name   text not null,  -- денормализовано на случай удаления сотрудника
  amount          numeric(14,2) not null,
  created_at      timestamptz not null default now()
);

create index on report_prepayments (report_id);
create index on report_prepayments (employee_id);

-- ─── Автообновление updated_at ───────────────────────────────────────────────
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger daily_reports_updated_at
  before update on daily_reports
  for each row execute function set_updated_at();

create trigger profiles_updated_at
  before update on profiles
  for each row execute function set_updated_at();

-- ─── Автосоздание профиля при регистрации ────────────────────────────────────
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
