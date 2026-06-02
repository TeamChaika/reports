-- Native iiko markup (ProductCostBase.MarkUp), stored as a fraction (2.086 = 208.6%)
alter table iiko_summary_cache
  add column if not exists markup numeric(10,4) not null default 0;
