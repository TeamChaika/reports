-- Per-establishment financial summary (markup, cost, discount) for the iiko dashboard
create table if not exists iiko_summary_cache (
  id               uuid primary key default gen_random_uuid(),
  department_id    uuid references iiko_departments(id),
  department_name  text not null,
  business_date    date not null,
  gross            numeric(14,2) not null default 0,  -- DishSumInt (без скидки)
  net              numeric(14,2) not null default 0,  -- DishDiscountSumInt (со скидкой)
  discount         numeric(14,2) not null default 0,  -- DiscountSum
  profit           numeric(14,2) not null default 0,  -- ProductCostBase.Profit (наценка, ₽)
  cost             numeric(14,2) not null default 0,  -- ProductCostBase.ProductCost
  fetched_at       timestamptz not null default now(),
  unique (department_name, business_date)
);

create index if not exists iiko_summary_cache_date on iiko_summary_cache (business_date);
create index if not exists iiko_summary_cache_dept_date on iiko_summary_cache (department_id, business_date);

-- Discount amounts grouped by discount type
create table if not exists iiko_discount_cache (
  id               uuid primary key default gen_random_uuid(),
  department_id    uuid references iiko_departments(id),
  department_name  text not null,
  business_date    date not null,
  discount_type    text not null default '',
  amount           numeric(14,2) not null default 0,  -- DiscountSum
  fetched_at       timestamptz not null default now(),
  unique (department_name, business_date, discount_type)
);

create index if not exists iiko_discount_cache_date on iiko_discount_cache (business_date);
create index if not exists iiko_discount_cache_dept_date on iiko_discount_cache (department_id, business_date);

alter table iiko_summary_cache  enable row level security;
alter table iiko_discount_cache enable row level security;

create policy iiko_summary_cache_read on iiko_summary_cache
  for select using (auth.uid() is not null);
create policy iiko_discount_cache_read on iiko_discount_cache
  for select using (auth.uid() is not null);
