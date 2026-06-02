alter table daily_reports
  add column if not exists iiko_shift_closed boolean;
