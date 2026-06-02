-- Hourly sales cache for the live iiko dashboard
create table if not exists iiko_hourly_cache (
  id               uuid primary key default gen_random_uuid(),
  department_id    uuid references iiko_departments(id),
  department_name  text not null,
  business_date    date not null,
  hour             int  not null,            -- 0..23 (HourOpen)
  revenue          numeric(14,2) not null default 0,  -- DishDiscountSumInt
  orders           int  not null default 0,            -- UniqOrderId.OrdersCount
  guests           numeric(14,2) not null default 0,   -- GuestNum
  fetched_at       timestamptz not null default now(),
  unique (department_name, business_date, hour)
);

create index if not exists iiko_hourly_cache_date on iiko_hourly_cache (business_date);
create index if not exists iiko_hourly_cache_dept_date on iiko_hourly_cache (department_id, business_date);

alter table iiko_hourly_cache enable row level security;

create policy iiko_hourly_cache_read on iiko_hourly_cache
  for select using (auth.uid() is not null);
