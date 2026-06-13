-- UpdateBoard - Supabase Schema
-- Run this in your Supabase project → SQL Editor

create table if not exists ub_drivers (
  id          bigint primary key,
  name        text not null default '',
  phone       text default '',
  truck       text default '',
  trailer     text default '',
  sort_order  int  default 0
);

create table if not exists ub_dispatch (
  driver_id   bigint primary key references ub_drivers(id) on delete cascade,
  status      text default '',
  pu          text default '',
  del_info    text default '',
  load_id     text default '',
  notes       text default '',
  updated_at  timestamptz default now()
);

create table if not exists ub_week_days (
  driver_id   bigint references ub_drivers(id) on delete cascade,
  week        text not null,
  day         text not null,
  status      text default 'driving',
  dollars     numeric,
  miles       numeric,
  pm          numeric,
  notes       text default '',
  updated_at  timestamptz default now(),
  primary key (driver_id, week, day)
);

create table if not exists ub_meta (
  id          int primary key default 1,
  year        int default 2026,
  week_a      jsonb default '{"label":"Week 1","days":{"MON":1,"TUE":2,"WED":3,"THU":4,"FRI":5,"SAT":6,"SUN":7}}'::jsonb,
  week_b      jsonb default '{"label":"Week 2","days":{"MON":8,"TUE":9,"WED":10,"THU":11,"FRI":12,"SAT":13,"SUN":14}}'::jsonb,
  threshold   numeric default 2.0,
  dark_mode   boolean default false,
  history     jsonb default '[]'::jsonb,
  updated_at  timestamptz default now()
);

-- Enable Row Level Security
alter table ub_drivers   enable row level security;
alter table ub_dispatch  enable row level security;
alter table ub_week_days enable row level security;
alter table ub_meta      enable row level security;

-- Allow full public access (no auth - single company board)
create policy "public" on ub_drivers   for all using (true) with check (true);
create policy "public" on ub_dispatch  for all using (true) with check (true);
create policy "public" on ub_week_days for all using (true) with check (true);
create policy "public" on ub_meta      for all using (true) with check (true);

-- Enable real-time for all tables
alter publication supabase_realtime add table ub_drivers;
alter publication supabase_realtime add table ub_dispatch;
alter publication supabase_realtime add table ub_week_days;
alter publication supabase_realtime add table ub_meta;

-- Seed meta row
insert into ub_meta (id) values (1) on conflict (id) do nothing;
