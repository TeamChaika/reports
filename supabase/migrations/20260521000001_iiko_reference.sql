-- iiko reference tables (synced from iiko API, never manually edited)
-- All tables use soft deletes: is_deleted flag, never hard DELETE

-- ─── Departments (рестораны и юрлица) ────────────────────────────────────────
create table iiko_departments (
  id            uuid primary key,          -- iiko UUID
  parent_id     uuid,                      -- parent JURPERSON
  code          text,                      -- числовой код заведения ('9', '6', ...)
  name          text not null,
  type          text not null,             -- DEPARTMENT | JURPERSON
  is_deleted    boolean not null default false,
  synced_at     timestamptz not null default now()
);

create index on iiko_departments (type);
create index on iiko_departments (code);

-- ─── Products / Nomenclature (номенклатура) ───────────────────────────────────
create table iiko_products (
  id                    uuid primary key,   -- iiko UUID
  parent_id             uuid,               -- UUID группы товаров
  code                  text,               -- внутренний код iiko
  num                   text,               -- артикул
  name                  text not null,
  type                  text not null,      -- GOODS | DISH | PREPARED | SERVICE | MODIFIER | OUTER | RATE
  deleted               boolean not null default false,  -- флаг из iiko
  default_sale_price    numeric(14,2) not null default 0,
  main_unit_id          uuid,               -- UUID единицы измерения
  category_id           uuid,
  accounting_category_id uuid,
  is_deleted            boolean not null default false,
  synced_at             timestamptz not null default now()
);

create index on iiko_products (type);
create index on iiko_products (parent_id);
create index on iiko_products (deleted);
create index on iiko_products (num);

-- ─── Employees (сотрудники) ───────────────────────────────────────────────────
create table iiko_employees (
  id                          uuid primary key,
  code                        text,
  name                        text not null,
  main_role_id                uuid,
  main_role_code              text,
  card_number                 text,
  preferred_department_code   text,
  department_codes            text,         -- raw string from iiko (может быть несколько через запятую)
  deleted                     boolean not null default false,
  supplier                    boolean not null default false,
  is_deleted                  boolean not null default false,
  synced_at                   timestamptz not null default now()
);

create index on iiko_employees (deleted);
create index on iiko_employees (supplier);
create index on iiko_employees (preferred_department_code);

-- ─── Stores (склады) ──────────────────────────────────────────────────────────
create table iiko_stores (
  id          uuid primary key,
  parent_id   uuid references iiko_departments(id),  -- department UUID
  code        text,
  name        text not null,
  type        text not null default 'STORE',
  is_deleted  boolean not null default false,
  synced_at   timestamptz not null default now()
);

create index on iiko_stores (parent_id);

-- ─── Pay Types (типы оплат — берём из OLAP, не из отдельного API) ─────────────
-- Заполняется автоматически при sync OLAP-данных
create table iiko_pay_types (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,         -- e.g. 'Банковские карты', 'Наличные'
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ─── OLAP Cache (кеш продаж из iiko для сверки) ──────────────────────────────
create table iiko_olap_cache (
  id                  uuid primary key default gen_random_uuid(),
  department_id       uuid references iiko_departments(id),
  department_name     text not null,        -- денормализовано для быстрых запросов
  business_date       date not null,
  pay_type            text not null,        -- строка из OLAP
  dish_amount         numeric(14,4) not null default 0,
  dish_sum            numeric(14,2) not null default 0,
  dish_discount_sum   numeric(14,2) not null default 0,
  fetched_at          timestamptz not null default now(),
  unique (department_name, business_date, pay_type)
);

create index on iiko_olap_cache (business_date);
create index on iiko_olap_cache (department_id);
create index on iiko_olap_cache (department_name, business_date);

-- ─── Sync Jobs (очередь задач воркера) ───────────────────────────────────────
create table sync_jobs (
  id            uuid primary key default gen_random_uuid(),
  type          text not null,     -- departments | products | employees | stores | olap
  status        text not null default 'pending',  -- pending | running | completed | failed
  started_at    timestamptz,
  completed_at  timestamptz,
  error         text,
  metadata      jsonb default '{}',
  created_at    timestamptz not null default now()
);

create index on sync_jobs (status, type);
create index on sync_jobs (created_at desc);
