-- Native iiko discount percent (DiscountPercent), stored as a fraction (0.1121 = 11.21%)
alter table iiko_summary_cache
  add column if not exists discount_pct numeric(10,4) not null default 0;
